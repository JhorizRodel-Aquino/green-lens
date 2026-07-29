import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

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

export default router;
