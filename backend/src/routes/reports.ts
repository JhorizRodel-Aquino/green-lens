import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolveJurisdiction, NotInPhilippinesError } from '../services/jurisdiction';
import { buildJurisdictionFilter } from '../services/reportScope';
import { requireUser, requireSuperAdmin } from '../middleware/requireUser';

const router = Router();

const PENDING_TIMEOUT_MS = 24 * 60 * 60 * 1000;

const createReportSchema = z.object({
    lat: z.number(),
    lng: z.number(),
    details: z.string().min(1),
    imageUrls: z.array(z.string()).default([]),
});

router.post('/', async (req, res, next) => {
    try {
        const { imageUrls, ...data } = createReportSchema.parse(req.body);
        const jurisdiction = await resolveJurisdiction(data.lat, data.lng);

        const report = await prisma.report.create({
            data: { ...data, ...jurisdiction, images: { create: imageUrls.map((url) => ({ url })) } },
            include: { images: true, status: true },
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
        const reports = await prisma.report.findMany({ where, include: { images: true, status: true, notes: true }, orderBy: { createdAt: 'desc' } });
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
});

router.patch('/:id/reopen', requireUser, async (req, res, next) => {
    try {
        const { note } = reopenReportSchema.parse(req.body);
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
                notes: { create: [{ text: note, kind: 'REOPEN' as const }] },
            },
            include: { images: true, status: true, notes: true },
        });
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
            include: { images: true, status: true },
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
        });
        res.json(report);
    } catch (err) {
        next(err);
    }
});

export default router;
