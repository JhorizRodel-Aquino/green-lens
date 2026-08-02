import type { User } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';

/** Derives the Report `where` filter for a user's jurisdiction. UNASSIGNED reports never match. */
export function buildJurisdictionFilter(user: User): Prisma.ReportWhereInput {
    if (user.role === 'SUPER_ADMIN') return {};
    if (user.municipalityCode) return { municipalityCode: user.municipalityCode };
    if (user.provinceCode) return { provinceCode: user.provinceCode };
    return { regionCode: user.regionCode };
}
