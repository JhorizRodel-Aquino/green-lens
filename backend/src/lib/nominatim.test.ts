import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThrottle, reverseGeocode } from './nominatim';

test('createThrottle enforces the minimum interval between waits', async () => {
    const wait = createThrottle(50);
    const start = performance.now();
    await wait();
    await wait();
    await wait();
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 100, `expected >=100ms between 3 throttled calls, got ${elapsed}ms`);
});

test('reverseGeocode returns the address block from Nominatim', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
        assert.ok(url.includes('lat=14.45'));
        assert.ok(url.includes('lon=120.95'));
        assert.ok(url.includes('addressdetails=1'));
        return new Response(JSON.stringify({
            address: { country_code: 'ph', country: 'Philippines', city: 'Naic' },
            display_name: 'Naic, Cavite, Region IV-A, Philippines',
        }), { status: 200 });
    }) as typeof fetch;

    try {
        const { address, displayName } = await reverseGeocode(14.45, 120.95);
        assert.equal(address.country_code, 'ph');
        assert.equal(address.city, 'Naic');
        assert.equal(displayName, 'Naic, Cavite, Region IV-A, Philippines');
    } finally {
        globalThis.fetch = originalFetch;
    }
});
