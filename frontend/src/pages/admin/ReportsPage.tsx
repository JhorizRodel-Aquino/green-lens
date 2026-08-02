import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useReports } from '@/context/ReportsContext';
import { useAuth } from '@/context/AuthContext';
import ReportDetailPanel from '@/components/map/ReportDetailPanel';
import StatCard from '@/components/admin/StatCard';
import ReportCard from '@/components/admin/ReportCard';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import LguFilter, { useLguFilter } from '@/components/admin/LguFilter';
import { cn } from '@/utils/cn';
import { formatAvgResolutionTime, isWithinDatePreset, startOfToday, type DatePreset } from '@/utils/reportStats';

type Tab = 'all' | 'pending' | 'unresolved' | 'flagged' | 'resolved' | 'reopened' | 'unassigned';

const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'unresolved', label: 'Unresolved' },
    { key: 'flagged', label: 'Flagged' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'reopened', label: 'Reopened' },
];

export default function ReportsPage() {
    const { reports, loading, error, refresh } = useReports();
    const { user } = useAuth();
    const tabs = user?.role === 'SUPER_ADMIN'
        ? [...TABS, { key: 'unassigned' as const, label: 'Unassigned' }]
        : TABS;
    const { selectedLgu, setSelectedLgu, lguOptions, filteredReports: lguFilteredReports } = useLguFilter(reports);
    const [activeTab, setActiveTab] = useState<Tab>('all');
    const [datePreset, setDatePreset] = useState<DatePreset>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    const stats = useMemo(() => {
        const today = startOfToday();
        const highSeverityOpen = lguFilteredReports.filter((r) => r.severity === 'HIGH' && r.status !== 'resolved').length;
        const resolvedToday = lguFilteredReports.filter((r) => r.status === 'resolved' && r.resolvedAt && new Date(r.resolvedAt) >= today).length;
        const avgTime = formatAvgResolutionTime(lguFilteredReports);
        const lguResponseRate = lguFilteredReports.length === 0
            ? '—'
            : `${Math.round((lguFilteredReports.filter((r) => r.lguActionLogged).length / lguFilteredReports.length) * 100)}%`;

        return { highSeverityOpen, resolvedToday, avgTime, lguResponseRate };
    }, [lguFilteredReports]);

    const filteredReports = useMemo(() => {
        return lguFilteredReports.filter((r) => {
            if (activeTab === 'unassigned') return r.jurisdictionStatus === 'UNASSIGNED';
            if (activeTab === 'reopened') return r.wasReopened;
            if (activeTab !== 'all' && r.status !== activeTab) return false;
            return isWithinDatePreset(r.createdAt, datePreset, customFrom, customTo);
        });
    }, [lguFilteredReports, activeTab, datePreset, customFrom, customTo]);

    return (
        <>
        <div className="p-4 md:p-6 space-y-6">
            <h1 className="text-2xl font-bold text-dark">Reports</h1>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && reports.length === 0 && <p className="text-sm text-dark-light">Loading reports...</p>}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="High Severity" value={String(stats.highSeverityOpen)} icon={AlertTriangle} tone="danger" />
                <StatCard label="Resolved Today" value={String(stats.resolvedToday)} icon={CheckCircle2} tone="success" />
                <StatCard label="Avg. Time" value={stats.avgTime} icon={Clock3} tone="accent" />
                <StatCard label="LGU Response" value={stats.lguResponseRate} icon={ShieldCheck} tone="default" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex gap-1 rounded-lg border border-light-dark bg-white p-1 w-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => { setActiveTab(tab.key); refresh(); }}
                            className={cn(
                                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                                activeTab === tab.key ? 'bg-primary text-white' : 'text-dark-light hover:bg-light'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredReports.map((report) => (
                    <ReportCard key={report.id} report={report} onClick={() => setSelectedReportId(report.id)} />
                ))}

                {filteredReports.length === 0 && (
                    <p className="col-span-full text-center text-sm text-dark-light py-10">No reports match these filters.</p>
                )}
            </div>
        </div>

        {selectedReportId && (
            <ReportDetailPanel reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
        )}
        </>
    );
}
