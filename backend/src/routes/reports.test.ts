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

test('POST /api/reports rejects points outside the Philippines', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('nominatim.openstreetmap.org')) {
            return new Response(JSON.stringify({ address: { country_code: 'us' } }), { status: 200 });
        }
        return originalFetch(url, init);
    }) as typeof fetch;

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: 37.7, lng: -122.4, details: 'test' }),
            });
            assert.equal(res.status, 422);
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('GET /api/reports only returns reports within the caller jurisdiction', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Naic Agent', email: `naic-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE',
            regionCode: 'R4A', regionName: 'Region IV-A', provinceCode: 'CAV', provinceName: 'Cavite',
            municipalityCode: 'NAIC', municipalityName: 'Naic',
        },
    });
    const inJurisdiction = await prisma.report.create({
        data: {
            lat: 14.32, lng: 120.77, details: 'in scope', locationLabel: 'Naic, Cavite, Region IV-A, Philippines',
            regionCode: 'R4A', regionName: 'Region IV-A', provinceCode: 'CAV', provinceName: 'Cavite',
            municipalityCode: 'NAIC', municipalityName: 'Naic', jurisdictionStatus: 'ASSIGNED',
        },
    });
    const outOfJurisdiction = await prisma.report.create({
        data: {
            lat: 10.3, lng: 123.9, details: 'out of scope', locationLabel: 'Cebu City, Cebu, Region VII, Philippines',
            regionCode: 'R7', regionName: 'Region VII', provinceCode: 'CEB', provinceName: 'Cebu',
            municipalityCode: 'CEBU_CITY', municipalityName: 'Cebu City', jurisdictionStatus: 'ASSIGNED',
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports`, { headers: { 'x-user-id': agent.id } });
            assert.equal(res.status, 200);
            const reports = (await res.json()) as { id: string }[];
            const ids = reports.map((r) => r.id);
            assert.ok(ids.includes(inJurisdiction.id));
            assert.ok(!ids.includes(outOfJurisdiction.id));
        });
    } finally {
        await prisma.report.deleteMany({ where: { id: { in: [inJurisdiction.id, outOfJurisdiction.id] } } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});

test('PATCH /api/reports/:id/jurisdiction requires SUPER_ADMIN', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Non-Admin', email: `nonadmin-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R4A', regionName: 'Region IV-A',
        },
    });
    const report = await prisma.report.create({
        data: { lat: 14.32, lng: 120.77, details: 'unassigned', locationLabel: 'Somewhere, Philippines', jurisdictionStatus: 'UNASSIGNED' },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/jurisdiction`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': agent.id },
                body: JSON.stringify({ regionCode: 'R4A', regionName: 'Region IV-A' }),
            });
            assert.equal(res.status, 403);
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});
