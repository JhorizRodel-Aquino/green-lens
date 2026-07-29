import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { app } from '../app';

async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
    const server = app.listen(0);
    const { port } = server.address() as { port: number };
    try {
        return await fn(`http://localhost:${port}`);
    } finally {
        server.close();
    }
}

test('PATCH /api/users/:id updates name/email/role/jurisdiction', async () => {
    const user = await prisma.user.create({
        data: {
            name: 'Before Edit', email: `before-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R1', regionName: 'Region I',
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'After Edit', email: user.email, role: 'ADMIN',
                    regionCode: 'R2', regionName: 'Region II',
                }),
            });
            assert.equal(res.status, 200);
            const body = await res.json();
            assert.equal(body.name, 'After Edit');
            assert.equal(body.role, 'ADMIN');
            assert.equal(body.regionCode, 'R2');
        });
    } finally {
        await prisma.user.delete({ where: { id: user.id } });
    }
});

test('POST /api/users/:id/reset-password issues a new temp password', async () => {
    const user = await prisma.user.create({
        data: {
            name: 'Reset Me', email: `reset-${Date.now()}@gov.ph`, passwordHash: 'original-hash',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R1', regionName: 'Region I',
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/users/${user.id}/reset-password`, { method: 'POST' });
            assert.equal(res.status, 200);
            const body = await res.json();
            assert.equal(typeof body.tempPassword, 'string');
            assert.ok(body.tempPassword.length > 0);
            assert.equal(body.passwordHash, undefined);
        });

        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        assert.notEqual(updated.passwordHash, 'original-hash');
    } finally {
        await prisma.user.delete({ where: { id: user.id } });
    }
});
