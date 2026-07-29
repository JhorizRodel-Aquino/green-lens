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
            include: { images: true },
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
            where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - PENDING_TIMEOUT_MS) } },
            data: { status: 'REPORTED' },
        });

        const where = buildJurisdictionFilter(req.user);
        const reports = await prisma.report.findMany({ where, include: { images: true }, orderBy: { createdAt: 'desc' } });
        res.json(reports);
    } catch (err) {
        next(err);
    }
});

const setStatusSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('ACCEPT') }),
    z.object({ action: z.literal('FLAG'), flagReason: z.enum(['FALSE_REPORT', 'OUT_OF_CONTROL']) }),
]);

router.patch('/:id/status', requireUser, async (req, res, next) => {
    try {
        const body = setStatusSchema.parse(req.body);
        const report = await prisma.report.update({
            where: { id: req.params.id as string },
            data: body.action === 'ACCEPT'
                ? { status: 'REPORTED' }
                : { status: 'FLAGGED', flagReason: body.flagReason, flaggedAt: new Date() },
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
