import { useMemo, useState } from 'react';
import { FileText, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useReports } from '@/context/ReportsContext';
import { useAuth } from '@/context/AuthContext';
import StatCard from '@/components/admin/StatCard';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import LguFilter, { useLguFilter } from '@/components/admin/LguFilter';
import { formatAvgResolutionTime, isWithinDatePreset, type DatePreset } from '@/utils/reportStats';

export default function AnalyticsPage() {
    const { reports } = useReports();
    const { user } = useAuth();
    const [datePreset, setDatePreset] = useState<DatePreset>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const { selectedLgu, setSelectedLgu, lguOptions, filteredReports: lguFilteredReports } = useLguFilter(reports, user?.role !== 'LGU_AGENT');

    const filteredReports = useMemo(
        () => lguFilteredReports.filter((r) => isWithinDatePreset(r.createdAt, datePreset, customFrom, customTo)),
        [lguFilteredReports, datePreset, customFrom, customTo]
    );

    const stats = useMemo(() => {
        const totalReports = filteredReports.length;
        const resolved = filteredReports.filter((r) => r.status === 'resolved').length;
        const resolutionRate = totalReports === 0 ? '—' : `${Math.round((resolved / totalReports) * 100)}%`;
        const avgResolution = formatAvgResolutionTime(filteredReports);
        const lguResponseRate = totalReports === 0
            ? '—'
            : `${Math.round((filteredReports.filter((r) => r.lguActionLogged).length / totalReports) * 100)}%`;
        return { totalReports, resolutionRate, avgResolution, lguResponseRate };
    }, [filteredReports]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <h1 className="text-2xl font-bold text-dark">Analytics</h1>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Reports" value={String(stats.totalReports)} icon={FileText} tone="default" />
                <StatCard label="Resolution Rate" value={stats.resolutionRate} icon={CheckCircle2} tone="success" />
                <StatCard label="Avg. Resolution Time" value={stats.avgResolution} icon={Clock3} tone="accent" />
                <StatCard label="LGU Response Rate" value={stats.lguResponseRate} icon={ShieldCheck} tone="default" />
            </div>
        </div>
    );
}
