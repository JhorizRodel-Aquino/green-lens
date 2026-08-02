import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart3, AlertTriangle, Clock3, Star, Sparkles, Trophy, Wrench,
} from 'lucide-react';
import { useReports } from '@/context/ReportsContext';
import { useAuth } from '@/context/AuthContext';
import { TrashMap } from '@/components/map/TrashMap';
import StatCard from '@/components/admin/StatCard';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import {
    formatAvgResolutionTime, isWithinDatePreset, jurisdictionLabel, getPeriodBounds, getPreviousPeriodBounds,
    reportsInPeriod, pctChange, avgResolutionHours, satisfactionRate, type DatePreset,
} from '@/utils/reportStats';
import LguFilter, { useLguFilter } from '@/components/admin/LguFilter';

const DISTRICT_TRENDS = [
    'District 3 resolution speed improved by 12% this week. This correlates with the new dispatch protocol.',
    'Alert: Barangay San Juan has seen a 30% spike in illegal dumping reports over 48 hours.',
    'Optimization tip: Re-allocating 2 teams from Zone 4 to Zone 1 could reduce backlog by 18%.',
];

// Nominatim addresses can run 10+ comma-separated segments long — keep just the first two for display
function shortenLocation(label: string): string {
    const parts = label.split(',').map((p) => p.trim()).filter(Boolean);
    return parts.slice(0, 2).join(', ');
}

function formatHours(hours: number | null): string {
    if (hours === null) return '—';
    return hours < 24 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`;
}

function letterGrade(pct: number): { grade: string; tone: string } {
    if (pct >= 90) return { grade: 'A+', tone: 'text-primary bg-primary' };
    if (pct >= 80) return { grade: 'A', tone: 'text-primary bg-primary' };
    if (pct >= 70) return { grade: 'B', tone: 'text-secondary-dark bg-secondary' };
    if (pct >= 60) return { grade: 'C', tone: 'text-secondary-dark bg-secondary' };
    if (pct >= 50) return { grade: 'D', tone: 'text-red-600 bg-red-500' };
    return { grade: 'F', tone: 'text-red-600 bg-red-500' };
}

export default function DashboardPage() {
    const { reports } = useReports();
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const [datePreset, setDatePreset] = useState<DatePreset>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const { selectedLgu, setSelectedLgu, lguOptions, filteredReports: lguFilteredReports } = useLguFilter(reports);

    const filteredReports = useMemo(
        () => lguFilteredReports.filter((r) => isWithinDatePreset(r.createdAt, datePreset, customFrom, customTo)),
        [lguFilteredReports, datePreset, customFrom, customTo]
    );

    const stats = useMemo(() => {
        const totalReports = filteredReports.length;
        const activeUnresolved = filteredReports.filter((r) => r.status !== 'resolved').length;
        const highPriorityOpen = filteredReports.filter((r) => r.severity === 'HIGH' && r.status !== 'resolved').length;
        const avgResolution = formatAvgResolutionTime(filteredReports);
        const csat = satisfactionRate(filteredReports);
        return { totalReports, activeUnresolved, highPriorityOpen, avgResolution, csat };
    }, [filteredReports]);

    // Trend deltas vs. the immediately preceding period of the same length
    const trends = useMemo(() => {
        const bounds = getPeriodBounds(datePreset, customFrom, customTo);
        if (!bounds) return null;
        const prevReports = reportsInPeriod(lguFilteredReports, getPreviousPeriodBounds(bounds));

        const totalChange = pctChange(filteredReports.length, prevReports.length);

        const curAvg = avgResolutionHours(filteredReports);
        const prevAvg = avgResolutionHours(prevReports);
        const avgChangeHours = curAvg !== null && prevAvg !== null ? curAvg - prevAvg : null;

        return { totalChange, avgChangeHours };
    }, [lguFilteredReports, filteredReports, datePreset, customFrom, customTo]);

    // Top locations by total report count, ranked by locationLabel
    const topReports = useMemo(() => {
        const counts = new Map<string, number>();
        for (const r of filteredReports) {
            const label = r.locationLabel ?? 'Unknown location';
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        const max = ranked[0]?.[1] ?? 1;
        return ranked.map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }));
    }, [filteredReports]);

    // Bottlenecks: locations with the most still-unresolved reports
    const bottlenecks = useMemo(() => {
        const counts = new Map<string, number>();
        for (const r of filteredReports) {
            if (r.status === 'resolved') continue;
            const label = r.locationLabel ?? 'Unknown location';
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count], i) => ({ rank: i + 1, name, count, featured: i === 0 }));
    }, [filteredReports]);

    // Per-jurisdiction stats, only meaningful for SUPER_ADMIN (sees all LGUs)
    const jurisdictionStats = useMemo(() => {
        type Bucket = { total: number; resolved: number; resolutionHoursSum: number; resolutionCount: number };
        const buckets = new Map<string, Bucket>();
        for (const r of filteredReports) {
            if (r.status === 'flagged') continue; // flagged reports don't count toward a jurisdiction's grade
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
    }, [filteredReports]);

    const performanceGrades = useMemo(
        () => [...jurisdictionStats]
            .sort((a, b) => b.resolutionRate - a.resolutionRate)
            .slice(0, 3)
            .map((j) => ({ district: j.name, pct: Math.round(j.resolutionRate), ...letterGrade(j.resolutionRate) })),
        [jurisdictionStats]
    );

    const champions = useMemo(
        () => [...jurisdictionStats]
            .sort((a, b) => b.resolved - a.resolved)
            .slice(0, 3)
            .map((j, i) => ({ name: j.name, count: j.resolved, featured: i === 0 })),
        [jurisdictionStats]
    );

    const fastestResponders = useMemo(
        () => jurisdictionStats
            .filter((j) => j.avgResolutionHours !== null)
            .sort((a, b) => (a.avgResolutionHours as number) - (b.avgResolutionHours as number))
            .slice(0, 3),
        [jurisdictionStats]
    );

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-dark">Executive Performance Overview</h1>
                    <p className="text-sm text-dark-light">LGU Environmental Intelligence Hub</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <LguFilter value={selectedLgu} onChange={setSelectedLgu} options={lguOptions} />
                    <DateRangeFilter
                        preset={datePreset}
                        onPresetChange={setDatePreset}
                        customFrom={customFrom}
                        onCustomFromChange={setCustomFrom}
                        customTo={customTo}
                        onCustomToChange={setCustomTo}
                    />
                </div>
            </div>

            {/* Top metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Reports"
                    value={String(stats.totalReports)}
                    icon={BarChart3}
                    tone="success"
                    trend={
                        trends?.totalChange !== null && trends?.totalChange !== undefined
                            ? {
                                direction: trends.totalChange >= 0 ? 'up' : 'down',
                                label: `${trends.totalChange >= 0 ? '+' : ''}${trends.totalChange.toFixed(1)}% from last period`,
                                tone: 'neutral',
                            }
                            : undefined
                    }
                />
                <StatCard
                    label="Active Unresolved"
                    value={String(stats.activeUnresolved)}
                    icon={AlertTriangle}
                    tone="danger"
                    trend={{ direction: 'up', label: `High priority: ${stats.highPriorityOpen} units`, tone: 'danger' }}
                />
                <StatCard
                    label="Avg. Resolution"
                    value={stats.avgResolution}
                    icon={Clock3}
                    tone="accent"
                    trend={
                        trends?.avgChangeHours !== null && trends?.avgChangeHours !== undefined
                            ? {
                                direction: trends.avgChangeHours <= 0 ? 'down' : 'up',
                                label: `${trends.avgChangeHours <= 0 ? '' : '+'}${trends.avgChangeHours.toFixed(1)}h vs last period`,
                                tone: trends.avgChangeHours <= 0 ? 'success' : 'danger',
                            }
                            : undefined
                    }
                />
                <StatCard
                    label="Resolved, Not Reopened"
                    value={stats.csat !== null ? `${stats.csat.toFixed(0)}%` : '—'}
                    icon={Star}
                    tone="accent"
                    trend={{
                        direction: 'up',
                        label: 'Of reports ever resolved',
                        tone: 'neutral',
                    }}
                />
            </div>

            {/* AI summary + geographic performance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 rounded-xl border border-light-dark border-l-4 border-l-primary bg-white p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={18} className="text-primary" />
                        <h3 className="text-sm font-semibold text-dark">District Trends</h3>
                    </div>
                    <div className="space-y-2 flex-grow">
                        {DISTRICT_TRENDS.map((tip, i) => (
                            <div key={i} className="bg-light p-2.5 rounded-lg border border-light-dark">
                                <p className="text-sm text-dark">{tip}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 rounded-xl border border-light-dark bg-white overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-light-dark flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-dark">District Performance Map</h3>
                        <Link to="/admin/map" className="text-xs font-medium text-primary hover:underline">View full map</Link>
                    </div>
                    <div className="flex flex-col md:flex-row h-[340px]">
                        <div className={isSuperAdmin ? 'w-full md:w-2/3 h-[300px] md:h-full relative' : 'w-full h-[300px] md:h-full relative'}>
                            <TrashMap reports={filteredReports} showLogo={false} />
                        </div>
                        {isSuperAdmin && (
                            <div className="w-full md:w-1/3 p-4 border-t md:border-t-0 md:border-l border-light-dark bg-white flex flex-col gap-2 overflow-y-auto">
                                <p className="text-xs font-medium text-dark-light mb-1">Performance Grades</p>
                                {performanceGrades.length === 0 && <p className="text-sm text-dark-light">No jurisdiction data yet.</p>}
                                {performanceGrades.map((g) => (
                                    <div key={g.district}>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-dark">{g.district}</span>
                                            <span className={cnGrade(g.tone)}>{g.grade}</span>
                                        </div>
                                        <div className="w-full bg-light h-1.5 rounded-full overflow-hidden mt-1">
                                            <div className={cnBar(g.tone)} style={{ width: `${g.pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Leaderboards bento grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-xl border border-light-dark bg-white p-4 flex flex-col">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-dark-light mb-3">Top 10: Most Reports</h4>
                    <div className="space-y-3">
                        {topReports.length === 0 && <p className="text-sm text-dark-light">No reports yet.</p>}
                        {topReports.map((r) => (
                            <div key={r.name}>
                                <div className="flex justify-between gap-2 text-sm">
                                    <span className="text-dark truncate" title={r.name}>{shortenLocation(r.name)}</span>
                                    <span className="font-bold text-dark shrink-0">{r.count}</span>
                                </div>
                                <div className="w-full bg-light h-2 rounded-full overflow-hidden mt-1">
                                    <div className="bg-primary h-full" style={{ width: `${r.pct}%` }} />
                                </div>
                            </div>
                        ))}
                        <div className="pt-2 text-center border-t border-light-dark">
                            <button type="button" className="text-primary text-sm font-medium hover:underline">View All 10</button>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-light-dark  bg-white p-4 flex flex-col">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-dark-light mb-3">Top 10: Bottlenecks</h4>
                    <div className="space-y-3 flex-1">
                        {bottlenecks.length === 0 && <p className="text-sm text-dark-light">No active reports.</p>}
                        {bottlenecks.map((b) => (
                            <div key={b.rank} className="flex items-center gap-2.5">
                                <div className={cnRank(b.featured)}>{b.rank}</div>
                                <div className="flex-grow min-w-0">
                                    <div className="text-sm font-semibold text-dark truncate" title={b.name}>{shortenLocation(b.name)}</div>
                                    <div className="text-[11px] text-dark-light">{b.count} Active Reports</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="pt-2 text-center border-t border-light-dark mt-3">
                        <button type="button" className="text-red-600 text-sm font-medium hover:underline">Escalate Units</button>
                    </div>
                </div>

                {isSuperAdmin && (
                    <div className="rounded-xl border border-light-dark bg-white p-4 flex flex-col">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-dark-light mb-3">Resolution Champions</h4>
                        <div className="space-y-2 flex-1">
                            {champions.length === 0 && <p className="text-sm text-dark-light">No resolved reports yet.</p>}
                            {champions.map((c) => (
                                <div
                                    key={c.name}
                                    className={c.featured
                                        ? 'flex items-center justify-between bg-primary-light/20 p-2 rounded-lg border border-primary/20'
                                        : 'flex items-center justify-between p-2 rounded-lg border border-light-dark'}
                                >
                                    <div className="flex items-center gap-2">
                                        {c.featured ? <Trophy size={16} className="text-primary" /> : <Wrench size={16} className="text-dark-light" />}
                                        <span className={c.featured ? 'text-sm font-semibold text-dark' : 'text-sm text-dark'}>{c.name}</span>
                                    </div>
                                    <span className={c.featured ? 'text-primary font-bold text-sm' : 'text-dark font-bold text-sm'}>{c.count} Fixed</span>
                                </div>
                            ))}
                        </div>
                        <div className="pt-2 text-center border-t border-light-dark mt-3">
                            <button type="button" className="text-primary text-sm font-medium hover:underline">Performance Rewards</button>
                        </div>
                    </div>
                )}

                {isSuperAdmin && (
                    <div className="rounded-xl bg-primary-dark text-white p-4 flex flex-col">
                        <h4 className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-3">Fastest Responders</h4>
                        {fastestResponders.length === 0 ? (
                            <div className="flex-grow flex items-center justify-center text-sm opacity-80">No resolved reports yet.</div>
                        ) : (
                            <div className="flex-grow flex flex-col justify-center gap-4">
                                <div className="text-center">
                                    <div className="text-[11px] uppercase opacity-70 mb-1">Leader</div>
                                    <div className="text-sm font-semibold">{fastestResponders[0].name}</div>
                                    <div className="text-2xl font-extrabold mt-1">{formatHours(fastestResponders[0].avgResolutionHours)}</div>
                                    <div className="text-[11px] opacity-80">Average Resolution Time</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {fastestResponders.slice(1, 3).map((j) => (
                                        <div key={j.name} className="bg-white/10 p-2 rounded text-center">
                                            <div className="text-[10px] uppercase opacity-70">{j.name}</div>
                                            <div className="text-sm font-bold">{formatHours(j.avgResolutionHours)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function cnGrade(tone: string): string {
    return `font-bold text-sm ${tone.split(' ')[0]}`;
}

function cnBar(tone: string): string {
    return `h-full rounded-full ${tone.split(' ')[1]}`;
}

function cnRank(featured: boolean): string {
    return featured
        ? 'h-8 w-8 shrink-0 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs'
        : 'h-8 w-8 shrink-0 rounded-full bg-light text-dark flex items-center justify-center font-bold text-xs';
}
