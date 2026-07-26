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

export function formatAvgResolutionTime(reports: TrashReport[]): string {
    const resolved = reports.filter((r) => r.status === 'resolved' && r.resolvedAt);
    if (resolved.length === 0) return '—';
    const totalHours = resolved.reduce((sum, r) => {
        const created = new Date(r.createdAt).getTime();
        const resolvedAt = new Date(r.resolvedAt!).getTime();
        return sum + (resolvedAt - created) / (1000 * 60 * 60);
    }, 0);
    const avg = totalHours / resolved.length;
    return avg < 24 ? `${avg.toFixed(1)}h` : `${(avg / 24).toFixed(1)}d`;
}
