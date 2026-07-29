import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolveJurisdiction, NotInPhilippinesError } from '../services/jurisdiction';
import { buildJurisdictionFilter } from '../services/reportScope';
import { requireUser, requireSuperAdmin } from '../middleware/requireUser';

const router = Router();

const createReportSchema = z.object({
    lat: z.number(),
    lng: z.number(),
    details: z.string().min(1),
    imageUrls: z.array(z.string()).default([]),
});

router.post('/', async (req, res, next) => {
    try {
        const data = createReportSchema.parse(req.body);
        const jurisdiction = await resolveJurisdiction(data.lat, data.lng);

        const report = await prisma.report.create({
            data: { ...data, ...jurisdiction },
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
        const where = buildJurisdictionFilter(req.user);
        const reports = await prisma.report.findMany({ where, orderBy: { createdAt: 'desc' } });
        res.json(reports);
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
