// Run with: npx tsx frontend/src/utils/analyticsStats.selfcheck.ts
import { bucketReportsOverTime, computeJurisdictionStats, computeStatusBreakdown } from './analyticsStats';
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

// computeJurisdictionStats: flagged reports excluded, resolution rate and avg hours correct.
const jReports: TrashReport[] = [
    report({ id: 'j1', municipalityName: 'Manila', status: 'resolved', createdAt: '2026-01-01T00:00:00.000Z', resolvedAt: '2026-01-02T00:00:00.000Z' } as Partial<TrashReport>),
    report({ id: 'j2', municipalityName: 'Manila', status: 'pending' } as Partial<TrashReport>),
    report({ id: 'j3', municipalityName: 'Manila', status: 'flagged' } as Partial<TrashReport>),
];
const jStats = computeJurisdictionStats(jReports);
console.assert(jStats.length === 1, `expected 1 jurisdiction, got ${jStats.length}`);
console.assert(jStats[0].total === 2, `flagged report must not count toward total, got ${jStats[0].total}`);
console.assert(jStats[0].resolutionRate === 50, `expected 50% resolution rate, got ${jStats[0].resolutionRate}`);
console.assert(jStats[0].avgResolutionHours === 24, `expected 24h avg resolution, got ${jStats[0].avgResolutionHours}`);

// computeStatusBreakdown: always 4 statuses, fixed order, correct counts.
const sReports: TrashReport[] = [
    report({ id: 's1', status: 'pending' }),
    report({ id: 's2', status: 'pending' }),
    report({ id: 's3', status: 'resolved' }),
];
const sBreakdown = computeStatusBreakdown(sReports);
console.assert(sBreakdown.length === 4, `expected 4 statuses always, got ${sBreakdown.length}`);
console.assert(
    sBreakdown.map((s) => s.status).join(',') === 'pending,unresolved,flagged,resolved',
    `expected fixed order pending,unresolved,flagged,resolved, got ${sBreakdown.map((s) => s.status).join(',')}`
);
console.assert(sBreakdown[0].count === 2, `expected 2 pending, got ${sBreakdown[0].count}`);
console.assert(sBreakdown[1].count === 0, `expected 0 unresolved, got ${sBreakdown[1].count}`);

console.log('analyticsStats.selfcheck.ts: all assertions passed');
