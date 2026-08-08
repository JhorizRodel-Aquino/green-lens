import type { TrashReport } from '@/components/map/TrashMap';
import { getPeriodBounds, jurisdictionLabel, type DatePreset, type PeriodBounds } from '@/utils/reportStats';

type Granularity = 'hour' | 'day' | 'week';

function bucketKeyAndLabel(date: Date, granularity: Granularity): { key: string; label: string } {
    if (granularity === 'hour') {
        const key = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const label = date.toLocaleTimeString('en-US', { hour: 'numeric' });
        return { key, label };
    }
    if (granularity === 'day') {
        const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { key, label };
    }
    // week: bucket by the Monday of that week
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { key, label };
}

function granularityFor(preset: DatePreset, bounds: PeriodBounds | null): Granularity {
    if (preset === 'today') return 'hour';
    if (preset === 'week') return 'day';
    if (preset === 'month') return 'week';
    if (!bounds) return 'week';
    const spanDays = (bounds.end.getTime() - bounds.start.getTime()) / 86_400_000;
    return spanDays <= 31 ? 'day' : 'week';
}

export type TimeBucket = { key: string; label: string; filed: number; resolved: number };

/** Buckets reports by createdAt (Filed) and resolvedAt (Resolved) into a time series.
 * Granularity auto-adjusts to the date preset so "today" never renders as one point. */
export function bucketReportsOverTime(
    reports: TrashReport[],
    preset: DatePreset,
    customFrom: string,
    customTo: string
): TimeBucket[] {
    const bounds = getPeriodBounds(preset, customFrom, customTo);
    const granularity = granularityFor(preset, bounds);
    const buckets = new Map<string, TimeBucket>();

    for (const r of reports) {
        const { key, label } = bucketKeyAndLabel(new Date(r.createdAt), granularity);
        const bucket = buckets.get(key) ?? { key, label, filed: 0, resolved: 0 };
        bucket.filed += 1;
        buckets.set(key, bucket);

        if (r.status === 'resolved' && r.resolvedAt) {
            const rKeyLabel = bucketKeyAndLabel(new Date(r.resolvedAt), granularity);
            const rBucket = buckets.get(rKeyLabel.key) ?? { key: rKeyLabel.key, label: rKeyLabel.label, filed: 0, resolved: 0 };
            rBucket.resolved += 1;
            buckets.set(rKeyLabel.key, rBucket);
        }
    }

    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export type JurisdictionStat = {
    name: string;
    total: number;
    resolved: number;
    resolutionRate: number;
    avgResolutionHours: number | null;
};

/** Per-jurisdiction totals/resolution rate/avg resolution time. Flagged reports don't count
 * toward a jurisdiction's grade. Extracted from DashboardPage so Dashboard and Analytics
 * compute this identically instead of duplicating the logic. */
export function computeJurisdictionStats(reports: TrashReport[]): JurisdictionStat[] {
    type Bucket = { total: number; resolved: number; resolutionHoursSum: number; resolutionCount: number };
    const buckets = new Map<string, Bucket>();
    for (const r of reports) {
        if (r.status === 'flagged') continue;
        const key = jurisdictionLabel(r);
        const b = buckets.get(key) ?? { total: 0, resolved: 0, resolutionHoursSum: 0, resolutionCount: 0 };
        b.total += 1;
        if (r.status === 'resolved') {
            b.resolved += 1;
            if (r.resolvedAt) {
                const hours = (new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime()) / 3_600_000;
                if (hours >= 0) {
                    b.resolutionHoursSum += hours;
                    b.resolutionCount += 1;
                }
            }
        }
        buckets.set(key, b);
    }
    return [...buckets.entries()].map(([name, b]) => ({
        name,
        total: b.total,
        resolved: b.resolved,
        resolutionRate: b.total > 0 ? (b.resolved / b.total) * 100 : 0,
        avgResolutionHours: b.resolutionCount > 0 ? b.resolutionHoursSum / b.resolutionCount : null,
    }));
}

export type StatusCount = { status: TrashReport['status']; label: string; count: number };

const STATUS_ORDER: { status: TrashReport['status']; label: string }[] = [
    { status: 'pending', label: 'Pending' },
    { status: 'unresolved', label: 'Unresolved' },
    { status: 'flagged', label: 'Flagged' },
    { status: 'resolved', label: 'Resolved' },
];

/** Count of reports per status, always returning all 4 statuses in a fixed order (0 if none),
 * so the chart's bar order/colors never shift based on which statuses happen to be present. */
export function computeStatusBreakdown(reports: TrashReport[]): StatusCount[] {
    const counts = new Map<TrashReport['status'], number>();
    for (const r of reports) {
        counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    }
    return STATUS_ORDER.map(({ status, label }) => ({ status, label, count: counts.get(status) ?? 0 }));
}
