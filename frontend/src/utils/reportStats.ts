import type { TrashReport } from '@/components/map/TrashMap';

export type DatePreset = 'today' | 'week' | 'month' | 'custom';

export function startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

export function isWithinDatePreset(iso: string, preset: DatePreset, customFrom: string, customTo: string): boolean {
    const date = new Date(iso);

    if (preset === 'custom') {
        if (!customFrom && !customTo) return true;
        if (customFrom && date < new Date(customFrom)) return false;
        if (customTo && date > new Date(`${customTo}T23:59:59`)) return false;
        return true;
    }

    const today = startOfToday();
    if (preset === 'today') return date >= today;

    if (preset === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date >= weekAgo;
    }

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return date >= monthAgo;
}

export function jurisdictionLabel(r: Pick<TrashReport, 'municipalityName' | 'provinceName' | 'regionName'>): string {
    return r.municipalityName ?? r.provinceName ?? r.regionName ?? 'Unassigned';
}

export type PeriodBounds = { start: Date; end: Date };

/** Bounds of the currently selected date filter. Custom with no dates set has no meaningful "period" to compare against. */
export function getPeriodBounds(preset: DatePreset, customFrom: string, customTo: string): PeriodBounds | null {
    const now = new Date();
    if (preset === 'today') return { start: startOfToday(), end: now };
    if (preset === 'week') {
        const start = new Date(startOfToday());
        start.setDate(start.getDate() - 7);
        return { start, end: now };
    }
    if (preset === 'month') {
        const start = new Date(startOfToday());
        start.setMonth(start.getMonth() - 1);
        return { start, end: now };
    }
    if (!customFrom && !customTo) return null;
    return {
        start: customFrom ? new Date(customFrom) : new Date(0),
        end: customTo ? new Date(`${customTo}T23:59:59`) : now,
    };
}

/** The period immediately preceding `bounds`, same duration — used for "vs. last period" trend deltas. */
export function getPreviousPeriodBounds({ start, end }: PeriodBounds): PeriodBounds {
    const durationMs = end.getTime() - start.getTime();
    return { start: new Date(start.getTime() - durationMs), end: new Date(start.getTime()) };
}

export function reportsInPeriod(reports: TrashReport[], bounds: PeriodBounds): TrashReport[] {
    return reports.filter((r) => {
        const created = new Date(r.createdAt);
        return created >= bounds.start && created < bounds.end;
    });
}

/** % change from `previous` to `current`, or null when there's no baseline to compare against. */
export function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null;
    return ((current - previous) / previous) * 100;
}

export function avgResolutionHours(reports: TrashReport[]): number | null {
    const resolved = reports.filter((r) => r.status === 'resolved' && r.resolvedAt);
    if (resolved.length === 0) return null;
    const totalHours = resolved.reduce((sum, r) => sum + (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()) / 3_600_000, 0);
    return totalHours / resolved.length;
}

/** % of ever-resolved reports (currently resolved, or reopened after having been resolved) that have never been reopened. */
export function satisfactionRate(reports: TrashReport[]): number | null {
    const everResolved = reports.filter((r) => r.status === 'resolved' || r.wasReopened);
    if (everResolved.length === 0) return null;
    const notReopened = everResolved.filter((r) => !r.wasReopened).length;
    return (notReopened / everResolved.length) * 100;
}

export function formatAvgResolutionTime(reports: TrashReport[]): string {
    const avg = avgResolutionHours(reports);
    if (avg === null) return '—';
    return avg < 24 ? `${avg.toFixed(1)}h` : `${(avg / 24).toFixed(1)}d`;
}
