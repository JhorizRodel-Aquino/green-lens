import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveJurisdiction, NotInPhilippinesError } from './jurisdiction';

function fakeFetch(routes: Record<string, unknown>): typeof fetch {
    return (async (url: string) => {
        for (const [pattern, body] of Object.entries(routes)) {
            if (url.includes(pattern)) return new Response(JSON.stringify(body), { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;
}

test('resolveJurisdiction throws NotInPhilippinesError outside PH', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch({
        'nominatim.openstreetmap.org': { address: { country_code: 'us' } },
    });
    try {
        await assert.rejects(() => resolveJurisdiction(37.7, -122.4), NotInPhilippinesError);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('resolveJurisdiction returns ASSIGNED on a full region/province/municipality match', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch({
        'nominatim.openstreetmap.org': { address: { country_code: 'ph', city: 'Naic', county: 'Cavite', state: 'Region IV-A' } },
        '/regions/R4A/provinces/': [{ code: 'CAV', name: 'Cavite' }],
        '/provinces/CAV/cities-municipalities/': [{ code: 'NAIC', name: 'Naic' }],
        '/regions/': [{ code: 'R4A', name: 'Region IV-A' }],
    });

    try {
        const result = await resolveJurisdiction(14.32, 120.77);
        assert.deepEqual(result, {
            jurisdictionStatus: 'ASSIGNED',
            regionCode: 'R4A', regionName: 'Region IV-A',
            provinceCode: 'CAV', provinceName: 'Cavite',
            municipalityCode: 'NAIC', municipalityName: 'Naic',
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('resolveJurisdiction returns UNASSIGNED when no region matches', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch({
        'nominatim.openstreetmap.org': { address: { country_code: 'ph', state: 'Somewhere Unmapped' } },
        '/regions/': [{ code: 'R4A', name: 'Region IV-A' }],
    });

    try {
        const result = await resolveJurisdiction(14.32, 120.77);
        assert.equal(result.jurisdictionStatus, 'UNASSIGNED');
        assert.equal(result.regionCode, null);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
