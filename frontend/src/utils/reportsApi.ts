// utils/reportsApi.ts — maps backend Report shape to the frontend's TrashReport
import type { TrashReport, FlagReasonCode } from '@/components/map/TrashMap';
import { apiFetch } from './api';

type ApiStatus = 'PENDING' | 'REPORTED' | 'RESOLVED' | FlagReasonCode;

interface ApiReport {
    id: string;
    lat: number;
    lng: number;
    severity: 'HIGH' | 'LOW' | null;
    details: string;
    locationLabel: string;
    images: { url: string; kind: 'USER_UPLOAD' | 'RESOLUTION_PROOF' }[];
    statusValue: ApiStatus;
    status: { value: ApiStatus; validity: 'VALID' | 'FLAGGED' };
    notes: { text: string; kind: 'RESOLUTION' | 'REOPEN'; createdAt: string }[];
    createdAt: string;
    resolvedAt: string | null;
    flaggedAt: string | null;
    lguActionLogged: boolean;
}

function toTrashReport(r: ApiReport): TrashReport {
    // validity comes from the ReportStatusCode join, not a hardcoded status list
    const isFlagged = r.status.validity === 'FLAGGED';
    const status: TrashReport['status'] =
        isFlagged ? 'flagged'
        : r.statusValue === 'PENDING' ? 'pending'
        : r.statusValue === 'REPORTED' ? 'unresolved'
        : 'resolved';

    return {
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        // ponytail: no LGU-facing "set severity" flow exists yet — reporters don't send it, default LOW until one does
        severity: r.severity ?? 'LOW',
        details: r.details,
        locationLabel: r.locationLabel,
        imageUrls: r.images.filter((i) => i.kind === 'USER_UPLOAD').map((i) => i.url),
        resolutionProofUrls: r.images.filter((i) => i.kind === 'RESOLUTION_PROOF').map((i) => i.url),
        status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt ?? undefined,
        flagReason: isFlagged ? (r.statusValue as FlagReasonCode) : undefined,
        flaggedAt: r.flaggedAt ?? undefined,
        lguActionLogged: r.lguActionLogged,
        remarks: (r.notes ?? []).map((n) => ({
            text: n.kind === 'REOPEN' ? `Reopened: ${n.text}` : n.text,
            createdAt: n.createdAt,
        })),
    };
}

export async function fetchReports(): Promise<TrashReport[]> {
    const reports = await apiFetch<ApiReport[]>('/api/reports');
    return reports.map(toTrashReport);
}

export async function acceptReportApi(id: string): Promise<TrashReport> {
    const report = await apiFetch<ApiReport>(`/api/reports/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'ACCEPT' }),
    });
    return toTrashReport(report);
}

export async function flagReportApi(id: string, reason: FlagReasonCode): Promise<TrashReport> {
    const report = await apiFetch<ApiReport>(`/api/reports/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'FLAG', reason }),
    });
    return toTrashReport(report);
}

export async function resolveReportApi(id: string, proofImageUrls: string[], note?: string): Promise<TrashReport> {
    const report = await apiFetch<ApiReport>(`/api/reports/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ proofImageUrls, note }),
    });
    return toTrashReport(report);
}

export async function reopenReportApi(id: string, note: string): Promise<TrashReport> {
    const report = await apiFetch<ApiReport>(`/api/reports/${id}/reopen`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
    });
    return toTrashReport(report);
}
