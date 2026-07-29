import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TrashReport, FlagReasonCode } from '@/components/map/TrashMap';
import { fetchReports, acceptReportApi, flagReportApi, resolveReportApi } from '@/utils/reportsApi';

type ReportsContextValue = {
    reports: TrashReport[];
    loading: boolean;
    error: string | null;
    refresh: () => void;
    updateReport: (id: string, patch: Partial<TrashReport>) => void;
    acceptReport: (id: string) => Promise<void>;
    flagReport: (id: string, reason: FlagReasonCode) => Promise<void>;
    resolveReport: (id: string, resolutionProofUrls: string[]) => Promise<void>;
    addRemark: (id: string, text: string) => void;
};

const ReportsContext = createContext<ReportsContextValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
    const [reports, setReports] = useState<TrashReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchReports()
            .then((data) => { if (!cancelled) { setReports(data); setError(null); } })
            .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load reports'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [refreshKey]);

    const updateReport = useCallback((id: string, patch: Partial<TrashReport>) => {
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }, []);

    const acceptReport = useCallback(async (id: string) => {
        const updated = await acceptReportApi(id);
        updateReport(id, updated);
    }, [updateReport]);

    const flagReport = useCallback(async (id: string, reason: FlagReasonCode) => {
        const updated = await flagReportApi(id, reason);
        updateReport(id, updated);
    }, [updateReport]);

    const resolveReport = useCallback(async (id: string, resolutionProofUrls: string[]) => {
        const updated = await resolveReportApi(id, resolutionProofUrls);
        updateReport(id, updated);
    }, [updateReport]);

    // Remarks aren't backed by the API yet — kept as local-only UI state.
    const addRemark = useCallback((id: string, text: string) => {
        setReports((prev) =>
            prev.map((r) =>
                r.id === id
                    ? { ...r, remarks: [...(r.remarks ?? []), { text, createdAt: new Date().toISOString() }] }
                    : r
            )
        );
    }, []);

    const value = useMemo(
        () => ({ reports, loading, error, refresh, updateReport, acceptReport, flagReport, resolveReport, addRemark }),
        [reports, loading, error, refresh, updateReport, acceptReport, flagReport, resolveReport, addRemark]
    );

    return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function useReports() {
    const ctx = useContext(ReportsContext);
    if (!ctx) throw new Error('useReports must be used within a ReportsProvider');
    return ctx;
}
