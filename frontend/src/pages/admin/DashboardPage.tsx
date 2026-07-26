import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart3, AlertTriangle, Clock3, Star, Sparkles, Trophy, Wrench,
} from 'lucide-react';
import { useReports } from '@/context/ReportsContext';
import { TrashMap } from '@/components/map/TrashMap';
import StatCard from '@/components/admin/StatCard';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { formatAvgResolutionTime, isWithinDatePreset, type DatePreset } from '@/utils/reportStats';

const DISTRICT_TRENDS = [
    'District 3 resolution speed improved by 12% this week. This correlates with the new dispatch protocol.',
    'Alert: Barangay San Juan has seen a 30% spike in illegal dumping reports over 48 hours.',
    'Optimization tip: Re-allocating 2 teams from Zone 4 to Zone 1 could reduce backlog by 18%.',
];

const PERFORMANCE_GRADES = [
    { district: 'District 4', grade: 'A+', pct: 95, tone: 'text-primary bg-primary' },
    { district: 'District 1', grade: 'B', pct: 72, tone: 'text-secondary-dark bg-secondary' },
    { district: 'District 7', grade: 'C-', pct: 48, tone: 'text-red-600 bg-red-500' },
];

const TOP_REPORTS = [
    { name: 'Brgy. Commonwealth', count: 212, pct: 90 },
    { name: 'Brgy. Payatas', count: 184, pct: 78 },
    { name: 'Brgy. Batasan Hills', count: 156, pct: 65 },
];

const BOTTLENECKS = [
    { rank: 1, name: 'Industrial Zone C', count: 42, featured: true },
    { rank: 2, name: 'District 5 Market', count: 28, featured: false },
    { rank: 3, name: 'Riverside Drive', count: 19, featured: false },
];

const CHAMPIONS = [
    { name: 'Unit Alpha-01', count: 482, featured: true },
    { name: 'Unit Gamma-04', count: 391, featured: false },
    { name: 'Unit Beta-12', count: 310, featured: false },
];

export default function DashboardPage() {
    const { reports } = useReports();
    const [datePreset, setDatePreset] = useState<DatePreset>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const filteredReports = useMemo(
        () => reports.filter((r) => isWithinDatePreset(r.createdAt, datePreset, customFrom, customTo)),
        [reports, datePreset, customFrom, customTo]
    );

    const stats = useMemo(() => {
        const totalReports = filteredReports.length;
        const activeUnresolved = filteredReports.filter((r) => r.status !== 'resolved').length;
        const highPriorityOpen = filteredReports.filter((r) => r.severity === 'HIGH' && r.status !== 'resolved').length;
        const avgResolution = formatAvgResolutionTime(filteredReports);
        return { totalReports, activeUnresolved, highPriorityOpen, avgResolution };
    }, [filteredReports]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-dark">Executive Performance Overview</h1>
                    <p className="text-sm text-dark-light">LGU Environmental Intelligence Hub</p>
                </div>
                <DateRangeFilter
                    preset={datePreset}
                    onPresetChange={setDatePreset}
                    customFrom={customFrom}
                    onCustomFromChange={setCustomFrom}
                    customTo={customTo}
                    onCustomToChange={setCustomTo}
                />
            </div>

            {/* Top metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Reports"
                    value={String(stats.totalReports)}
                    icon={BarChart3}
                    tone="success"
                    trend={{ direction: 'up', label: '+8.4% from last month' }}
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
                    trend={{ direction: 'down', label: '-15m improved speed' }}
                />
                <StatCard
                    label="Citizen CSAT"
                    value="4.8/5"
                    icon={Star}
                    tone="accent"
                    trend={{ direction: 'up', label: '92% response rate (mock)', tone: 'neutral' }}
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
                        <div className="w-full md:w-2/3 h-[300px] md:h-full relative">
                            <TrashMap reports={filteredReports} showLogo={false} />
                        </div>
                        <div className="w-full md:w-1/3 p-4 border-t md:border-t-0 md:border-l border-light-dark bg-white flex flex-col gap-2 overflow-y-auto">
                            <p className="text-xs font-medium text-dark-light mb-1">Performance Grades</p>
                            {PERFORMANCE_GRADES.map((g) => (
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
                    </div>
                </div>
            </div>

            {/* Leaderboards bento grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-xl border border-light-dark bg-white p-4 flex flex-col">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-dark-light mb-3">Top 10: Most Reports</h4>
                    <div className="space-y-3">
                        {TOP_REPORTS.map((r) => (
                            <div key={r.name}>
                                <div className="flex justify-between text-sm">
                                    <span className="text-dark">{r.name}</span>
                                    <span className="font-bold text-dark">{r.count}</span>
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

                <div className="rounded-xl border border-light-dark border-t-2 border-t-red-500 bg-white p-4 flex flex-col">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-dark-light mb-3">Top 10: Bottlenecks</h4>
                    <div className="space-y-3 flex-1">
                        {BOTTLENECKS.map((b) => (
                            <div key={b.rank} className="flex items-center gap-2.5">
                                <div className={cnRank(b.featured)}>{b.rank}</div>
                                <div className="flex-grow">
                                    <div className="text-sm font-semibold text-dark">{b.name}</div>
                                    <div className="text-[11px] text-dark-light">{b.count} Active Reports</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="pt-2 text-center border-t border-light-dark mt-3">
                        <button type="button" className="text-red-600 text-sm font-medium hover:underline">Escalate Units</button>
                    </div>
                </div>

                <div className="rounded-xl border border-light-dark bg-white p-4 flex flex-col">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-dark-light mb-3">Resolution Champions</h4>
                    <div className="space-y-2 flex-1">
                        {CHAMPIONS.map((c) => (
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

                <div className="rounded-xl bg-primary-dark text-white p-4 flex flex-col">
                    <h4 className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-3">Fastest Responders</h4>
                    <div className="flex-grow flex flex-col justify-center gap-4">
                        <div className="text-center">
                            <div className="text-[11px] uppercase opacity-70 mb-1">Leader of the Week</div>
                            <div className="text-sm font-semibold">District 2 Rapid Team</div>
                            <div className="text-2xl font-extrabold mt-1">1.8h</div>
                            <div className="text-[11px] opacity-80">Average Resolution Time</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white/10 p-2 rounded text-center">
                                <div className="text-[10px] uppercase opacity-70">Team B</div>
                                <div className="text-sm font-bold">2.4h</div>
                            </div>
                            <div className="bg-white/10 p-2 rounded text-center">
                                <div className="text-[10px] uppercase opacity-70">Team G</div>
                                <div className="text-sm font-bold">2.6h</div>
                            </div>
                        </div>
                    </div>
                </div>
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
