import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const createUserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['ADMIN', 'LGU_AGENT']),
    regionCode: z.string().min(1),
    regionName: z.string().min(1),
    provinceCode: z.string().nullish(),
    provinceName: z.string().nullish(),
    municipalityCode: z.string().nullish(),
    municipalityName: z.string().nullish(),
});

router.get('/', async (_req, res, next) => {
    try {
        const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(users.map(toPublicUser));
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const data = createUserSchema.parse(req.body);

        // ponytail: no invite-email flow yet, seed a random temp password the admin relays out-of-band
        const tempPassword = crypto.randomBytes(9).toString('base64url');
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const user = await prisma.user.create({
            data: { ...data, passwordHash, status: 'ACTIVE' },
        });

        res.status(201).json({ ...toPublicUser(user), tempPassword });
    } catch (err) {
        next(err);
    }
});

router.patch('/:id/status', async (req, res, next) => {
    try {
        const status = z.enum(['ACTIVE', 'BLOCKED']).parse(req.body.status);
        const user = await prisma.user.update({ where: { id: req.params.id }, data: { status } });
        res.json(toPublicUser(user));
    } catch (err) {
        next(err);
    }
});

router.patch('/:id', async (req, res, next) => {
    try {
        const data = createUserSchema.parse(req.body);
        const user = await prisma.user.update({ where: { id: req.params.id }, data });
        res.json(toPublicUser(user));
    } catch (err) {
        next(err);
    }
});

router.post('/:id/reset-password', async (req, res, next) => {
    try {
        const tempPassword = crypto.randomBytes(9).toString('base64url');
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        const user = await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
        res.json({ ...toPublicUser(user), tempPassword });
    } catch (err) {
        next(err);
    }
});

function toPublicUser(user: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>) {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
}

export default router;
