import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../lib/prisma';
import { requireUser, requireSuperAdmin } from './requireUser';

test('requireUser rejects requests with no x-user-id header', async () => {
    const app = express();
    app.get('/ping', requireUser, (_req, res) => res.json({ ok: true }));
    const server = app.listen(0);
    const { port } = server.address() as { port: number };

    try {
        const res = await fetch(`http://localhost:${port}/ping`);
        assert.equal(res.status, 401);
    } finally {
        server.close();
    }
});

test('requireUser attaches req.user for a valid header, requireSuperAdmin 403s a non-super-admin', async () => {
    const user = await prisma.user.create({
        data: {
            name: 'Test Agent', email: `agent-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R1', regionName: 'Region I',
        },
    });

    const app = express();
    app.get('/whoami', requireUser, (req, res) => res.json({ id: req.user.id }));
    app.get('/admin-only', requireUser, requireSuperAdmin, (_req, res) => res.json({ ok: true }));
    const server = app.listen(0);
    const { port } = server.address() as { port: number };

    try {
        const whoami = await fetch(`http://localhost:${port}/whoami`, { headers: { 'x-user-id': user.id } });
        assert.equal(whoami.status, 200);
        assert.deepEqual(await whoami.json(), { id: user.id });

        const adminOnly = await fetch(`http://localhost:${port}/admin-only`, { headers: { 'x-user-id': user.id } });
        assert.equal(adminOnly.status, 403);
    } finally {
        server.close();
        await prisma.user.delete({ where: { id: user.id } });
    }
});
