// Run with: npx tsx frontend/src/utils/analyticsStats.selfcheck.ts
import { bucketReportsOverTime } from './analyticsStats';
import type { TrashReport } from '../components/map/TrashMap';

function report(overrides: Partial<TrashReport>): TrashReport {
    return {
        id: overrides.id ?? Math.random().toString(),
        lat: 14.6, lng: 121.0,
        severity: 'LOW',
        details: 'test',
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...overrides,
    } as TrashReport;
}

// "week" preset -> daily granularity. Two reports on the same day should merge into one bucket.
const reports: TrashReport[] = [
    report({ id: '1', createdAt: '2026-01-05T08:00:00.000Z' }),
    report({ id: '2', createdAt: '2026-01-05T18:00:00.000Z' }),
    report({ id: '3', createdAt: '2026-01-06T09:00:00.000Z', status: 'resolved', resolvedAt: '2026-01-07T09:00:00.000Z' }),
];

const buckets = bucketReportsOverTime(reports, 'week', '', '');
console.assert(buckets.length === 3, `expected 3 buckets (Jan 5, 6, 7), got ${buckets.length}`);

const jan5 = buckets.find((b) => b.key === '2026-01-05');
console.assert(jan5?.filed === 2, `expected 2 filed on Jan 5, got ${jan5?.filed}`);

const jan7 = buckets.find((b) => b.key === '2026-01-07');
console.assert(jan7?.resolved === 1, `expected 1 resolved on Jan 7 (resolvedAt date), got ${jan7?.resolved}`);

// Sorted ascending by key.
console.assert(
    buckets.every((b, i) => i === 0 || buckets[i - 1].key < b.key),
    'buckets must be sorted ascending by key'
);

// "today" preset -> hourly granularity, same-day reports at different hours stay separate.
const hourlyReports: TrashReport[] = [
    report({ id: '4', createdAt: new Date(new Date().setHours(9, 0, 0, 0)).toISOString() }),
    report({ id: '5', createdAt: new Date(new Date().setHours(14, 0, 0, 0)).toISOString() }),
];
const hourlyBuckets = bucketReportsOverTime(hourlyReports, 'today', '', '');
console.assert(hourlyBuckets.length === 2, `expected 2 hourly buckets, got ${hourlyBuckets.length}`);

console.log('analyticsStats.selfcheck.ts: all assertions passed');
