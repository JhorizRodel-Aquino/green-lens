import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolveJurisdiction, NotInPhilippinesError } from '../services/jurisdiction';
import { buildJurisdictionFilter } from '../services/reportScope';
import { scoreSeverity } from '../services/severity';
import { uploadImages, saveImages } from '../lib/uploads';
import { requireUser, requireSuperAdmin } from '../middleware/requireUser';
import { imageUpload, fileUrl } from '../lib/imageUpload';

const router = Router();

const PENDING_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Multipart, so the numbers arrive as strings — coerce. No severity field: it is
// derived from the photos server-side, never sent by the client.
const createReportSchema = z.object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    details: z.string().min(1),
});

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const nearbyQuerySchema = z.object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    radiusMeters: z.coerce.number().positive().max(1000).default(20),
});

// Duplicate-check for the "Create Report" flow — public, no auth needed to check before submitting.
router.get('/nearby', async (req, res, next) => {
    try {
        const { lat, lng, radiusMeters } = nearbyQuerySchema.parse(req.query);

        // Coarse bounding box first (cheap, index-friendly), then exact haversine filter.
        const latDelta = radiusMeters / 111_320;
        const lngDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);

        const candidates = await prisma.report.findMany({
            where: {
                statusValue: { in: ['PENDING', 'REPORTED'] },
                lat: { gte: lat - latDelta, lte: lat + latDelta },
                lng: { gte: lng - lngDelta, lte: lng + lngDelta },
            },
            include: { images: true, status: true, _count: { select: { confirmations: true } } },
            orderBy: { createdAt: 'desc' },
        });

        const nearby = candidates
            .map((r) => ({ ...r, distanceMeters: Math.round(distanceMeters(lat, lng, r.lat, r.lng)) }))
            .filter((r) => r.distanceMeters <= radiusMeters)
            .sort((a, b) => a.distanceMeters - b.distanceMeters);

        res.json(nearby);
    } catch (err) {
        next(err);
    }
});

// multipart/form-data: text fields plus up to MAX_FILES photos under the `images` field.
router.post('/', uploadImages, async (req, res, next) => {
    try {
        const data = createReportSchema.parse(req.body);
        const files = (req.files ?? []) as Express.Multer.File[];
        if (files.length === 0) {
            res.status(400).json({ error: 'At least one photo is required.' });
            return;
        }

        // Score before geocoding and before touching disk: a photo with no trash in it costs
        // no Nominatim call and leaves no orphan file behind.
        const severity = await scoreSeverity(files.map((f) => f.buffer.toString('base64')));
        if (severity === 'NONE') {
            res.status(422).json({ error: 'No trash detected in the photos. Please retake a clearer photo of the trash.' });
            return;
        }

        const jurisdiction = await resolveJurisdiction(data.lat, data.lng);

        // Optional — a logged-in citizen gets reporterId set (needed to reopen it later); an
        // anonymous submission (no header, or a stale/invalid id) still goes through untied.
        const userId = req.header('x-user-id');
        const reporterId = userId ? (await prisma.user.findUnique({ where: { id: userId } }))?.id ?? null : null;

        const imageUrls = await saveImages(files);

        const report = await prisma.report.create({
            data: { ...data, severity, ...jurisdiction, reporterId, images: { create: imageUrls.map((url) => ({ url })) } },
            include: { images: true, status: true, notes: true },
        });
        res.status(201).json(report);
    } catch (err) {
        if (err instanceof NotInPhilippinesError) {
            res.status(422).json({ error: err.message });
            return;
        }
        next(err);
    }
});

router.get('/', requireUser, async (req, res, next) => {
    try {
        // A report stuck in PENDING for a day auto-becomes REPORTED (LGU didn't act in time).
        await prisma.report.updateMany({
            where: { statusValue: 'PENDING', createdAt: { lt: new Date(Date.now() - PENDING_TIMEOUT_MS) } },
            data: { statusValue: 'REPORTED' },
        });

        const where = buildJurisdictionFilter(req.user);
        const reports = await prisma.report.findMany({
            where,
            include: { images: true, status: true, notes: true, _count: { select: { confirmations: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(reports);
    } catch (err) {
        next(err);
    }
});

const resolveReportSchema = z.object({
    proofImageUrls: z.array(z.string()).min(1),
    note: z.string().min(1).nullish(),
});

router.patch('/:id/resolve', requireUser, async (req, res, next) => {
    try {
        const { proofImageUrls, note } = resolveReportSchema.parse(req.body);
        const existing = await prisma.report.findUnique({ where: { id: req.params.id as string }, include: { status: true } });
        if (!existing) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }
        if (existing.status.validity !== 'VALID') {
            res.status(409).json({ error: 'A flagged report cannot be resolved' });
            return;
        }

        const report = await prisma.report.update({
            where: { id: req.params.id as string },
            data: {
                statusValue: 'RESOLVED',
                resolvedAt: new Date(),
                lguActionLogged: true,
                images: { create: proofImageUrls.map((url) => ({ url, kind: 'RESOLUTION_PROOF' as const })) },
                ...(note ? { notes: { create: [{ text: note, kind: 'RESOLUTION' as const }] } } : {}),
            },
            include: { images: true, status: true, notes: true },
        });
        res.json(report);
    } catch (err) {
        next(err);
    }
});

const reopenReportSchema = z.object({
    note: z.string().min(1),
    // Citizen's optional proof that it's still not actually resolved.
    imageUrls: z.array(z.string()).default([]),
});

router.patch('/:id/reopen', requireUser, async (req, res, next) => {
    try {
        const { note, imageUrls } = reopenReportSchema.parse(req.body);
        const existing = await prisma.report.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }
        if (existing.statusValue !== 'RESOLVED') {
            res.status(409).json({ error: 'Only a resolved report can be reopened' });
            return;
        }

        const report = await prisma.report.update({
            where: { id: req.params.id as string },
            data: {
                statusValue: 'REPORTED',
                resolvedAt: null,
                // The old resolution proof no longer applies now that the report's reopened —
                // clear it so the next resolve attempt's preview isn't masked by stale photos.
                images: {
                    deleteMany: { kind: 'RESOLUTION_PROOF' },
                    create: imageUrls.map((url) => ({ url, kind: 'USER_UPLOAD' as const })),
                },
                notes: { create: [{ text: note, kind: 'REOPEN' as const }] },
            },
            include: { images: true, status: true, notes: true },
        });
        res.json(report);
    } catch (err) {
        next(err);
    }
});

// Citizen-facing reopen: only the reporter who filed it, only while it's RESOLVED, and only
// within REOPEN_WINDOW_MS of resolution — past that the resolution stands.
router.patch('/:id/citizen-reopen', requireUser, async (req, res, next) => {
    try {
        const { note, imageUrls } = reopenReportSchema.parse(req.body);
        const existing = await prisma.report.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }
        if (existing.reporterId !== req.user.id) {
            res.status(403).json({ error: 'Only the person who filed this report can reopen it' });
            return;
        }
        if (existing.statusValue !== 'RESOLVED') {
            res.status(409).json({ error: 'Only a resolved report can be reopened' });
            return;
        }
        if (!existing.resolvedAt || Date.now() - existing.resolvedAt.getTime() > REOPEN_WINDOW_MS) {
            res.status(409).json({ error: 'The 7-day reopen window for this report has passed' });
            return;
        }

        const report = await prisma.report.update({
            where: { id: req.params.id as string },
            data: {
                statusValue: 'REPORTED',
                resolvedAt: null,
                images: {
                    deleteMany: { kind: 'RESOLUTION_PROOF' },
                    create: imageUrls.map((url) => ({ url, kind: 'USER_UPLOAD' as const })),
                },
                notes: { create: [{ text: note, kind: 'REOPEN' as const }] },
            },
            include: { images: true, status: true, notes: true },
        });
        res.json(report);
    } catch (err) {
        next(err);
    }
});

const addRemarkSchema = z.object({
    text: z.string().min(1),
});

router.post('/:id/remarks', requireUser, async (req, res, next) => {
    try {
        const { text } = addRemarkSchema.parse(req.body);
        const existing = await prisma.report.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }
        if (existing.reporterId !== req.user.id) {
            res.status(403).json({ error: 'Only the person who filed this report can add remarks to it' });
            return;
        }

        const report = await prisma.report.update({
            where: { id: req.params.id as string },
            data: { notes: { create: [{ text, kind: 'CITIZEN_REMARK' as const }] } },
            include: { images: true, status: true, notes: true },
        });
        res.status(201).json(report);
    } catch (err) {
        next(err);
    }
});

// "I saw this too" — one per (report, citizen). Not the reporter-only remarks/reopen: anyone
// logged in can confirm any report, that's the point (independent corroboration).
router.post('/:id/confirm', requireUser, async (req, res, next) => {
    try {
        const existing = await prisma.report.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }

        try {
            await prisma.reportConfirmation.create({
                data: { reportId: req.params.id as string, userId: req.user.id },
            });
        } catch (err: any) {
            if (err?.code === 'P2002') {
                res.status(409).json({ error: 'You already confirmed this report' });
                return;
            }
            throw err;
        }

        const report = await prisma.report.findUnique({
            where: { id: req.params.id as string },
            include: { images: true, status: true, notes: true, _count: { select: { confirmations: true } } },
        });
        res.status(201).json(report);
    } catch (err) {
        next(err);
    }
});

router.delete('/:id/confirm', requireUser, async (req, res, next) => {
    try {
        await prisma.reportConfirmation.deleteMany({
            where: { reportId: req.params.id as string, userId: req.user.id },
        });
        const report = await prisma.report.findUnique({
            where: { id: req.params.id as string },
            include: { images: true, status: true, notes: true, _count: { select: { confirmations: true } } },
        });
        if (!report) {
            res.status(404).json({ error: 'Report not found' });
            return;
        }
        res.json(report);
    } catch (err) {
        next(err);
    }
});

const FLAG_REASONS = ['FALSE_REPORT', 'DUPLICATE_REPORT', 'MINOR_LITTER', 'ALREADY_RESOLVED', 'PRIVATE_PROPERTY'] as const;

const setStatusSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('ACCEPT') }),
    z.object({ action: z.literal('FLAG'), reason: z.enum(FLAG_REASONS) }),
]);

router.patch('/:id/status', requireUser, async (req, res, next) => {
    try {
        const body = setStatusSchema.parse(req.body);
        const report = await prisma.report.update({
            where: { id: req.params.id as string },
            data: body.action === 'ACCEPT'
                ? { statusValue: 'REPORTED' }
                : { statusValue: body.reason, flaggedAt: new Date() },
            include: { images: true, status: true, notes: true },
        });
        res.json(report);
    } catch (err) {
        next(err);
    }
});

const assignJurisdictionSchema = z.object({
    regionCode: z.string().min(1),
    regionName: z.string().min(1),
    provinceCode: z.string().nullish(),
    provinceName: z.string().nullish(),
    municipalityCode: z.string().nullish(),
    municipalityName: z.string().nullish(),
});

router.patch('/:id/jurisdiction', requireUser, requireSuperAdmin, async (req, res, next) => {
    try {
        const data = assignJurisdictionSchema.parse(req.body);
        const report = await prisma.report.update({
            where: { id: req.params.id as string },
            data: { ...data, jurisdictionStatus: 'ASSIGNED' },
            include: { images: true, status: true, notes: true },
        });
        res.json(report);
    } catch (err) {
        next(err);
    }
});

export default router;
