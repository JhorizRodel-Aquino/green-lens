import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, findBestMatch, fetchRegions } from './psgc';

test('normalizeName strips prefixes, accents, and casing', () => {
    assert.equal(normalizeName('City of Parañaque'), 'paranaque');
    assert.equal(normalizeName('Municipality of Naic'), 'naic');
    assert.equal(normalizeName('  Quezon   City  '), 'quezon city');
});

test('findBestMatch returns the first candidate that matches an option, normalized', () => {
    const options = [{ code: '1', name: 'Naic' }, { code: '2', name: 'Tanza' }];
    const match = findBestMatch(['Unknown Place', 'Municipality of Naic'], options);
    assert.deepEqual(match, { code: '1', name: 'Naic' });
});

test('findBestMatch returns null when nothing matches', () => {
    const options = [{ code: '1', name: 'Naic' }];
    assert.equal(findBestMatch(['Nowhere'], options), null);
});

test('fetchRegions calls the PSGC regions endpoint', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
        assert.equal(url, 'https://psgc.gitlab.io/api/regions/');
        return new Response(JSON.stringify([{ code: '040000000', name: 'Region IV-A' }]), { status: 200 });
    }) as typeof fetch;

    try {
        const regions = await fetchRegions();
        assert.deepEqual(regions, [{ code: '040000000', name: 'Region IV-A' }]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
