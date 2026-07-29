// utils/reportsApi.ts — maps backend Report shape to the frontend's TrashReport
import type { TrashReport, FlagReasonCode } from '@/components/map/TrashMap';
import { apiFetch } from './api';

type ApiStatus = 'PENDING' | 'REPORTED' | 'RESOLVED' | 'FALSE_REPORT' | 'DUPLICATE_REPORT' | 'MINOR_LITTER' | 'ALREADY_RESOLVED' | 'PRIVATE_PROPERTY';

const FLAG_STATUS_TO_REASON: Partial<Record<ApiStatus, FlagReasonCode>> = {
    FALSE_REPORT: 'false_report',
    DUPLICATE_REPORT: 'duplicate_report',
    MINOR_LITTER: 'minor_litter',
    ALREADY_RESOLVED: 'already_resolved',
    PRIVATE_PROPERTY: 'private_property',
};

const REASON_TO_FLAG_STATUS: Record<FlagReasonCode, ApiStatus> = {
    false_report: 'FALSE_REPORT',
    duplicate_report: 'DUPLICATE_REPORT',
    minor_litter: 'MINOR_LITTER',
    already_resolved: 'ALREADY_RESOLVED',
    private_property: 'PRIVATE_PROPERTY',
};

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
    createdAt: string;
    resolvedAt: string | null;
    flaggedAt: string | null;
    lguActionLogged: boolean;
}

function toTrashReport(r: ApiReport): TrashReport {
    // validity comes from the ReportStatusCode join, not a hardcoded status list
    const status: TrashReport['status'] =
        r.status.validity === 'FLAGGED' ? 'flagged'
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
        flagReason: FLAG_STATUS_TO_REASON[r.statusValue],
        flaggedAt: r.flaggedAt ?? undefined,
        lguActionLogged: r.lguActionLogged,
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
        body: JSON.stringify({ action: 'FLAG', reason: REASON_TO_FLAG_STATUS[reason] }),
    });
    return toTrashReport(report);
}

export async function resolveReportApi(id: string, proofImageUrls: string[]): Promise<TrashReport> {
    const report = await apiFetch<ApiReport>(`/api/reports/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ proofImageUrls }),
    });
    return toTrashReport(report);
}
