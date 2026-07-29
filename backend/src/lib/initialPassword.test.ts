import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateInitialPassword } from './initialPassword';

test('combines name initials, first 2 letters of region, and year', () => {
    assert.equal(generateInitialPassword('Maria Cruz', 'NCR - National Capital Region', 2026), 'MCNC2026');
});

test('handles single-word names', () => {
    assert.equal(generateInitialPassword('Madonna', 'Region VII - Central Visayas', 2026), 'MRE2026');
});
