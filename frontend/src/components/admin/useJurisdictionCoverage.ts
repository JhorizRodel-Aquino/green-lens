import { useEffect, useState } from 'react';
import type { TrashReport } from '@/components/map/TrashMap';
import { apiFetch } from '@/utils/api';

type StaffJurisdiction = {
    role: string;
    regionCode: string | null;
    provinceCode: string | null;
    municipalityCode: string | null;
};

/** Does any ADMIN/LGU_AGENT account's jurisdiction encompass this report's? Mirrors buildJurisdictionFilter, in reverse. */
function isCovered(report: TrashReport, staff: StaffJurisdiction[]): boolean {
    return staff.some((u) => {
        if (u.municipalityCode) return u.municipalityCode === report.municipalityCode;
        if (u.provinceCode) return u.provinceCode === report.provinceCode;
        return u.regionCode === report.regionCode;
    });
}

/** Flags a report as "orphaned": jurisdiction was resolved, but no LGU/ADMIN account covers it yet. */
export function useJurisdictionCoverage() {
    const [staff, setStaff] = useState<StaffJurisdiction[] | null>(null);

    useEffect(() => {
        apiFetch<StaffJurisdiction[]>('/api/users')
            .then((users) => setStaff(users.filter((u) => u.role === 'ADMIN' || u.role === 'LGU_AGENT')))
            .catch(() => setStaff([]));
    }, []);

    function isOrphaned(report: TrashReport): boolean {
        if (!staff || report.jurisdictionStatus !== 'ASSIGNED') return false;
        return !isCovered(report, staff);
    }

    return { isOrphaned, loaded: staff !== null };
}
