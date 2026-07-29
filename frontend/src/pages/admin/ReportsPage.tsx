import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useReports } from '@/context/ReportsContext';
import ReportDetailPanel from '@/components/map/ReportDetailPanel';
import StatCard from '@/components/admin/StatCard';
import ReportCard from '@/components/admin/ReportCard';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { cn } from '@/utils/cn';
import { formatAvgResolutionTime, isWithinDatePreset, startOfToday, type DatePreset } from '@/utils/reportStats';

type Tab = 'all' | 'pending' | 'unresolved' | 'flagged' | 'resolved';

const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'unresolved', label: 'Unresolved' },
    { key: 'flagged', label: 'Flagged' },
    { key: 'resolved', label: 'Resolved' },
];

export default function ReportsPage() {
    const { reports, loading, error } = useReports();
    const [activeTab, setActiveTab] = useState<Tab>('all');
    const [datePreset, setDatePreset] = useState<DatePreset>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    const stats = useMemo(() => {
        const today = startOfToday();
        const highSeverityOpen = reports.filter((r) => r.severity === 'HIGH' && r.status !== 'resolved').length;
        const resolvedToday = reports.filter((r) => r.status === 'resolved' && r.resolvedAt && new Date(r.resolvedAt) >= today).length;
        const avgTime = formatAvgResolutionTime(reports);
        const lguResponseRate = reports.length === 0
            ? '—'
            : `${Math.round((reports.filter((r) => r.lguActionLogged).length / reports.length) * 100)}%`;

        return { highSeverityOpen, resolvedToday, avgTime, lguResponseRate };
    }, [reports]);

    const filteredReports = useMemo(() => {
        return reports.filter((r) => {
            if (activeTab !== 'all' && r.status !== activeTab) return false;
            return isWithinDatePreset(r.createdAt, datePreset, customFrom, customTo);
        });
    }, [reports, activeTab, datePreset, customFrom, customTo]);

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
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                                activeTab === tab.key ? 'bg-primary text-white' : 'text-dark-light hover:bg-light'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
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
