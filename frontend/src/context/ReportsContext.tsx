import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { TrashReport } from '@/components/map/TrashMap';
import { INITIAL_REPORTS } from '@/data/reports';

type ReportsContextValue = {
    reports: TrashReport[];
    updateReport: (id: string, patch: Partial<TrashReport>) => void;
    flagReport: (id: string, reason: 'false_report' | 'out_of_control') => void;
    resolveReport: (id: string, resolutionProofUrls: string[]) => void;
    addRemark: (id: string, text: string) => void;
};

const ReportsContext = createContext<ReportsContextValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
    const [reports, setReports] = useState<TrashReport[]>(INITIAL_REPORTS);

    const updateReport = useCallback((id: string, patch: Partial<TrashReport>) => {
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }, []);

    const flagReport = useCallback(
        (id: string, reason: 'false_report' | 'out_of_control') => {
            updateReport(id, { status: 'flagged', flagReason: reason, flaggedAt: new Date().toISOString() });
        },
        [updateReport]
    );

    const resolveReport = useCallback(
        (id: string, resolutionProofUrls: string[]) => {
            updateReport(id, {
                status: 'resolved',
                resolvedAt: new Date().toISOString(),
                lguActionLogged: true,
                resolutionProofUrls,
            });
        },
        [updateReport]
    );

    const addRemark = useCallback(
        (id: string, text: string) => {
            setReports((prev) =>
                prev.map((r) =>
                    r.id === id
                        ? { ...r, remarks: [...(r.remarks ?? []), { text, createdAt: new Date().toISOString() }] }
                        : r
                )
            );
        },
        []
    );

    const value = useMemo(
        () => ({ reports, updateReport, flagReport, resolveReport, addRemark }),
        [reports, updateReport, flagReport, resolveReport, addRemark]
    );

    return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function useReports() {
    const ctx = useContext(ReportsContext);
    if (!ctx) throw new Error('useReports must be used within a ReportsProvider');
    return ctx;
}
