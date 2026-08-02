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

test('PATCH /api/reports/:id/status accepts a report (PENDING -> REPORTED)', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Status Agent', email: `status-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R4A', regionName: 'Region IV-A',
        },
    });
    const report = await prisma.report.create({
        data: { lat: 14.32, lng: 120.77, details: 'awaiting review', locationLabel: 'Somewhere, Philippines' },
    });
    assert.equal(report.statusValue, 'PENDING');

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': agent.id },
                body: JSON.stringify({ action: 'ACCEPT' }),
            });
            assert.equal(res.status, 200);
            const updated = (await res.json()) as { statusValue: string; status: { value: string; validity: string } };
            assert.equal(updated.statusValue, 'REPORTED');
            assert.equal(updated.status.validity, 'VALID');
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});

test('PATCH /api/reports/:id/resolve tags proof images separately from user uploads', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Resolve Agent', email: `resolve-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R4A', regionName: 'Region IV-A',
        },
    });
    const report = await prisma.report.create({
        data: {
            lat: 14.32, lng: 120.77, details: 'cleaned up', locationLabel: 'Somewhere, Philippines',
            images: { create: [{ url: 'https://example.com/user-photo.jpg' }] },
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/resolve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': agent.id },
                body: JSON.stringify({ proofImageUrls: ['https://example.com/proof.jpg'] }),
            });
            assert.equal(res.status, 200);
            const updated = (await res.json()) as { statusValue: string; resolvedAt: string | null; images: { url: string; kind: string }[] };
            assert.equal(updated.statusValue, 'RESOLVED');
            assert.ok(updated.resolvedAt);
            const byKind = Object.fromEntries(updated.images.map((i) => [i.url, i.kind]));
            assert.equal(byKind['https://example.com/user-photo.jpg'], 'USER_UPLOAD');
            assert.equal(byKind['https://example.com/proof.jpg'], 'RESOLUTION_PROOF');
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});

test('PATCH /api/reports/:id/resolve stores an optional note', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Resolve Note Agent', email: `resolvenote-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R4A', regionName: 'Region IV-A',
        },
    });
    const report = await prisma.report.create({
        data: { lat: 14.32, lng: 120.77, details: 'cleaned up', locationLabel: 'Somewhere, Philippines' },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/resolve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': agent.id },
                body: JSON.stringify({ proofImageUrls: ['https://example.com/proof.jpg'], note: 'Cleared by barangay crew.' }),
            });
            assert.equal(res.status, 200);
            const updated = (await res.json()) as { notes: { text: string; kind: string }[] };
            assert.equal(updated.notes.length, 1);
            assert.equal(updated.notes[0].text, 'Cleared by barangay crew.');
            assert.equal(updated.notes[0].kind, 'RESOLUTION');
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});

test('PATCH /api/reports/:id/reopen moves a RESOLVED report back to REPORTED with a note', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Reopen Agent', email: `reopen-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R4A', regionName: 'Region IV-A',
        },
    });
    const report = await prisma.report.create({
        data: {
            lat: 14.32, lng: 120.77, details: 'not actually cleaned', locationLabel: 'Somewhere, Philippines',
            statusValue: 'RESOLVED', resolvedAt: new Date(),
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/reopen`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': agent.id },
                body: JSON.stringify({ note: "Trash is still there, wasn't collected." }),
            });
            assert.equal(res.status, 200);
            const updated = (await res.json()) as { statusValue: string; resolvedAt: string | null; notes: { text: string; kind: string }[] };
            assert.equal(updated.statusValue, 'REPORTED');
            assert.equal(updated.resolvedAt, null);
            assert.equal(updated.notes.length, 1);
            assert.equal(updated.notes[0].kind, 'REOPEN');
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});

test('PATCH /api/reports/:id/reopen rejects reports that are not RESOLVED', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Reopen Reject Agent', email: `reopenreject-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R4A', regionName: 'Region IV-A',
        },
    });
    const report = await prisma.report.create({
        data: { lat: 14.32, lng: 120.77, details: 'still pending', locationLabel: 'Somewhere, Philippines' },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/reopen`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': agent.id },
                body: JSON.stringify({ note: 'not satisfied' }),
            });
            assert.equal(res.status, 409);
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});

test('PATCH /api/reports/:id/citizen-reopen allows the reporter within the 7-day window', async () => {
    const citizen = await prisma.user.create({
        data: { name: 'Citizen', email: `citizen-reopen-${Date.now()}@example.com`, passwordHash: 'x', role: 'CITIZEN', status: 'ACTIVE' },
    });
    const report = await prisma.report.create({
        data: {
            lat: 14.32, lng: 120.77, details: 'not actually cleaned', locationLabel: 'Somewhere, Philippines',
            statusValue: 'RESOLVED', resolvedAt: new Date(), reporterId: citizen.id,
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/citizen-reopen`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': citizen.id },
                body: JSON.stringify({ note: "Trash is still there, wasn't collected." }),
            });
            assert.equal(res.status, 200);
            const updated = (await res.json()) as { statusValue: string; resolvedAt: string | null };
            assert.equal(updated.statusValue, 'REPORTED');
            assert.equal(updated.resolvedAt, null);
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: citizen.id } });
    }
});

test('PATCH /api/reports/:id/citizen-reopen rejects a non-reporter', async () => {
    const citizen = await prisma.user.create({
        data: { name: 'Citizen', email: `citizen-notowner-${Date.now()}@example.com`, passwordHash: 'x', role: 'CITIZEN', status: 'ACTIVE' },
    });
    const otherCitizen = await prisma.user.create({
        data: { name: 'Other Citizen', email: `citizen-other-${Date.now()}@example.com`, passwordHash: 'x', role: 'CITIZEN', status: 'ACTIVE' },
    });
    const report = await prisma.report.create({
        data: {
            lat: 14.32, lng: 120.77, details: 'not actually cleaned', locationLabel: 'Somewhere, Philippines',
            statusValue: 'RESOLVED', resolvedAt: new Date(), reporterId: citizen.id,
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/citizen-reopen`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': otherCitizen.id },
                body: JSON.stringify({ note: 'not mine but trying anyway' }),
            });
            assert.equal(res.status, 403);
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: citizen.id } });
        await prisma.user.delete({ where: { id: otherCitizen.id } });
    }
});

test('PATCH /api/reports/:id/citizen-reopen rejects past the 7-day window', async () => {
    const citizen = await prisma.user.create({
        data: { name: 'Citizen', email: `citizen-expired-${Date.now()}@example.com`, passwordHash: 'x', role: 'CITIZEN', status: 'ACTIVE' },
    });
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const report = await prisma.report.create({
        data: {
            lat: 14.32, lng: 120.77, details: 'resolved a while ago', locationLabel: 'Somewhere, Philippines',
            statusValue: 'RESOLVED', resolvedAt: eightDaysAgo, reporterId: citizen.id,
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/citizen-reopen`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': citizen.id },
                body: JSON.stringify({ note: 'too late but trying anyway' }),
            });
            assert.equal(res.status, 409);
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: citizen.id } });
    }
});

test('POST /api/reports sets reporterId when the caller is logged in', async () => {
    const citizen = await prisma.user.create({
        data: { name: 'Citizen', email: `citizen-create-${Date.now()}@example.com`, passwordHash: 'x', role: 'CITIZEN', status: 'ACTIVE' },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': citizen.id },
                body: JSON.stringify({ lat: 14.32, lng: 120.77, details: 'trash pile' }),
            });
            assert.equal(res.status, 201);
            const body = await res.json();
            assert.equal(body.reporterId, citizen.id);
            await prisma.report.delete({ where: { id: body.id } });
        });
    } finally {
        await prisma.user.delete({ where: { id: citizen.id } });
    }
});

test('PATCH /api/reports/:id/status flags a report with a reason', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Flag Agent', email: `flag-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R4A', regionName: 'Region IV-A',
        },
    });
    const report = await prisma.report.create({
        data: { lat: 14.32, lng: 120.77, details: 'looks fake', locationLabel: 'Somewhere, Philippines' },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports/${report.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-user-id': agent.id },
                body: JSON.stringify({ action: 'FLAG', reason: 'FALSE_REPORT' }),
            });
            assert.equal(res.status, 200);
            const updated = (await res.json()) as { statusValue: string; status: { value: string; validity: string }; flaggedAt: string | null };
            assert.equal(updated.statusValue, 'FALSE_REPORT');
            assert.equal(updated.status.validity, 'FLAGGED');
            assert.ok(updated.flaggedAt);
        });
    } finally {
        await prisma.report.delete({ where: { id: report.id } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});

test('GET /api/reports auto-transitions stale PENDING reports to REPORTED', async () => {
    const agent = await prisma.user.create({
        data: {
            name: 'Sweep Agent', email: `sweep-${Date.now()}@gov.ph`, passwordHash: 'x',
            role: 'LGU_AGENT', status: 'ACTIVE', regionCode: 'R4A', regionName: 'Region IV-A',
        },
    });
    const staleReport = await prisma.report.create({
        data: {
            lat: 14.32, lng: 120.77, details: 'two days old', locationLabel: 'Somewhere, Philippines',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
    });

    try {
        await withServer(async (base) => {
            const res = await fetch(`${base}/api/reports`, { headers: { 'x-user-id': agent.id } });
            assert.equal(res.status, 200);
        });
        const refreshed = await prisma.report.findUniqueOrThrow({ where: { id: staleReport.id } });
        assert.equal(refreshed.statusValue, 'REPORTED');
    } finally {
        await prisma.report.delete({ where: { id: staleReport.id } });
        await prisma.user.delete({ where: { id: agent.id } });
    }
});
