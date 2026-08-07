import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import type { User } from '../generated/prisma/client';

declare global {
    namespace Express {
        interface Request {
            user: User;
        }
    }
}

// ponytail: dev-only stand-in for real auth (JWT/session) — the spec explicitly
// defers auth to a follow-up. Trusts an `x-user-id` header as-is; replace once
// login exists.
export const requireUser: RequestHandler = async (req, res, next) => {
    const userId = req.header('x-user-id');
    if (!userId) {
        res.status(401).json({ error: 'Missing x-user-id header' });
        return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        res.status(401).json({ error: 'Unknown user' });
        return;
    }

    req.user = user;
    next();
};

export const requireSuperAdmin: RequestHandler = (req, res, next) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        res.status(403).json({ error: 'Requires SUPER_ADMIN' });
        return;
    }
    next();
};
