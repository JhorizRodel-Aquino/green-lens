import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
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

test('POST /api/auth/login succeeds with correct credentials and omits the password hash', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const user = await prisma.user.create({
        data: {
            name: 'Login Agent', email: `login-${Date.now()}@gov.ph`, passwordHash,
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R1', regionName: 'Region I',
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, password: 'correct-horse' }),
            });
            assert.equal(res.status, 200);
            const body = await res.json();
            assert.equal(body.id, user.id);
            assert.equal(body.passwordHash, undefined);
        });
    } finally {
        await prisma.user.delete({ where: { id: user.id } });
    }
});

test('POST /api/auth/login rejects the wrong password', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const user = await prisma.user.create({
        data: {
            name: 'Wrong Password', email: `wrongpw-${Date.now()}@gov.ph`, passwordHash,
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R1', regionName: 'Region I',
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, password: 'wrong' }),
            });
            assert.equal(res.status, 401);
        });
    } finally {
        await prisma.user.delete({ where: { id: user.id } });
    }
});

test('POST /api/auth/login rejects a blocked account even with correct credentials', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const user = await prisma.user.create({
        data: {
            name: 'Blocked User', email: `blocked-${Date.now()}@gov.ph`, passwordHash,
            role: 'LGU_AGENT', status: 'BLOCKED', regionCode: 'R1', regionName: 'Region I',
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, password: 'correct-horse' }),
            });
            assert.equal(res.status, 403);
        });
    } finally {
        await prisma.user.delete({ where: { id: user.id } });
    }
});
