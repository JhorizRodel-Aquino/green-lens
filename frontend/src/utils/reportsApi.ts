// utils/reportsApi.ts — maps backend Report shape to the frontend's TrashReport
import type { TrashReport, FlagReasonCode } from '@/components/map/TrashMap';
import type { Severity } from '@/config/severity';
import { apiFetch, apiUpload } from './api';

type ApiStatus = 'PENDING' | 'REPORTED' | 'RESOLVED' | FlagReasonCode;

interface ApiReport {
    id: string;
    lat: number;
    lng: number;
    severity: Severity | null;
    details: string;
    locationLabel: string;
    municipalityName: string | null;
    provinceName: string | null;
    regionName: string | null;
    municipalityCode: string | null;
    provinceCode: string | null;
    regionCode: string | null;
    images: { url: string; kind: 'USER_UPLOAD' | 'RESOLUTION_PROOF' }[];
    statusValue: ApiStatus;
    status: { value: ApiStatus; validity: 'VALID' | 'FLAGGED' };
    notes: { text: string; kind: 'RESOLUTION' | 'REOPEN' | 'CITIZEN_REMARK'; createdAt: string }[];
    createdAt: string;
    resolvedAt: string | null;
    flaggedAt: string | null;
    lguActionLogged: boolean;
    jurisdictionStatus: 'ASSIGNED' | 'UNASSIGNED';
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
        // Severity is assigned by the backend, not the reporter; null (not yet assessed) falls back to LOW.
        severity: r.severity ?? 'LOW',
        details: r.details,
        locationLabel: r.locationLabel,
        municipalityName: r.municipalityName,
        provinceName: r.provinceName,
        regionName: r.regionName,
        municipalityCode: r.municipalityCode,
        provinceCode: r.provinceCode,
        regionCode: r.regionCode,
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
            kind: n.kind,
        })),
        wasReopened: (r.notes ?? []).some((n) => n.kind === 'REOPEN'),
        jurisdictionStatus: r.jurisdictionStatus,
    };
}

export async function fetchReports(): Promise<TrashReport[]> {
    const reports = await apiFetch<ApiReport[]>('/api/reports');
    return reports.map(toTrashReport);
}

// Report creation doesn't accept file uploads directly (see docs/USER_API.md) — photos have
// to be uploaded first to get back hosted URLs, then those URLs go in the report payload.
export async function uploadReportImages(files: Blob[]): Promise<string[]> {
    if (files.length === 0) return [];
    const form = new FormData();
    files.forEach((file, i) => form.append('images', file, `photo-${i}.jpg`));
    const { urls } = await apiUpload<{ urls: string[] }>('/api/uploads', form);
    return urls;
}

// No severity here — the backend assigns it, the citizen doesn't pick one at submission time.
export type CreateReportPayload = {
    lat: number;
    lng: number;
    details: string;
    imageUrls: string[];
};

export async function createReportApi(payload: CreateReportPayload): Promise<TrashReport> {
    const report = await apiFetch<ApiReport>('/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return toTrashReport(report);
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

export async function reopenReportApi(id: string, note: string, imageUrls?: string[]): Promise<TrashReport> {
    const report = await apiFetch<ApiReport>(`/api/reports/${id}/reopen`, {
        method: 'PATCH',
        body: JSON.stringify({ note, imageUrls }),
    });
    return toTrashReport(report);
}

export type AssignJurisdictionPayload = {
    regionCode: string; regionName: string;
    provinceCode?: string | null; provinceName?: string | null;
    municipalityCode?: string | null; municipalityName?: string | null;
};

export async function assignJurisdictionApi(id: string, payload: AssignJurisdictionPayload): Promise<TrashReport> {
    const report = await apiFetch<ApiReport>(`/api/reports/${id}/jurisdiction`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
    return toTrashReport(report);
}
