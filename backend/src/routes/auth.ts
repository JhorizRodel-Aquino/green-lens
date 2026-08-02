import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireUser } from '../middleware/requireUser';

const router = Router();

router.get('/me', requireUser, (req, res) => {
    const { passwordHash: _passwordHash, ...publicUser } = req.user;
    res.json(publicUser);
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        if (user.status === 'BLOCKED') {
            res.status(403).json({ error: 'This account has been blocked' });
            return;
        }

        const { passwordHash: _passwordHash, ...publicUser } = user;
        res.json(publicUser);
    } catch (err) {
        next(err);
    }
});

const signupSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
});

// Public — citizens self-register, unlike LGU/admin accounts which are created by a SUPER_ADMIN.
router.post('/signup', async (req, res, next) => {
    try {
        const { name, email, password } = signupSchema.parse(req.body);

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(409).json({ error: 'An account with this email already exists' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, passwordHash, role: 'CITIZEN', status: 'ACTIVE' },
        });

        const { passwordHash: _passwordHash, ...publicUser } = user;
        res.status(201).json(publicUser);
    } catch (err) {
        next(err);
    }
});

export default router;
