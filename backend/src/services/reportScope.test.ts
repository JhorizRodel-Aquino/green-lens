import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJurisdictionFilter } from './reportScope';
import type { User } from '../generated/prisma/client';

function makeUser(overrides: Partial<User>): User {
    return {
        id: '1', name: 'x', email: 'x@gov.ph', passwordHash: 'x',
        role: 'LGU_AGENT', status: 'ACTIVE',
        regionCode: null, regionName: null, provinceCode: null, provinceName: null,
        municipalityCode: null, municipalityName: null,
        createdAt: new Date(), updatedAt: new Date(),
        ...overrides,
    };
}

test('SUPER_ADMIN gets no filter', () => {
    const filter = buildJurisdictionFilter(makeUser({ role: 'SUPER_ADMIN' }));
    assert.deepEqual(filter, {});
});

test('municipality-level jurisdiction filters by municipalityCode', () => {
    const filter = buildJurisdictionFilter(makeUser({
        regionCode: 'R4A', provinceCode: 'CAV', municipalityCode: 'NAIC',
    }));
    assert.deepEqual(filter, { municipalityCode: 'NAIC' });
});

test('province-level jurisdiction (no municipality) filters by provinceCode', () => {
    const filter = buildJurisdictionFilter(makeUser({ regionCode: 'R4A', provinceCode: 'CAV' }));
    assert.deepEqual(filter, { provinceCode: 'CAV' });
});

test('region-level jurisdiction (no province) filters by regionCode', () => {
    const filter = buildJurisdictionFilter(makeUser({ regionCode: 'R4A' }));
    assert.deepEqual(filter, { regionCode: 'R4A' });
});
