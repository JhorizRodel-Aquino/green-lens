import type { TrashReport } from '@/components/map/TrashMap';
import { getPeriodBounds, type DatePreset, type PeriodBounds } from '@/utils/reportStats';

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
