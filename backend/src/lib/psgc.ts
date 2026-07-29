const BASE = 'https://psgc.gitlab.io/api';

export interface PsgcEntity {
    code: string;
    name: string;
}

/** Lowercase, strip accents/diacritics, drop "City of"/"Municipality of" prefixes, collapse whitespace. */
export function normalizeName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip accents
        .toLowerCase()
        .replace(/^(city of|municipality of)\s+/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Tries each candidate (in priority order) against every option; returns the first normalized match. */
export function findBestMatch(candidates: string[], options: PsgcEntity[]): PsgcEntity | null {
    for (const candidate of candidates) {
        const normalizedCandidate = normalizeName(candidate);
        const match = options.find((opt) => normalizeName(opt.name) === normalizedCandidate);
        if (match) return match;
    }
    return null;
}

async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`PSGC request failed: ${path} -> ${res.status}`);
    return res.json() as Promise<T>;
}

export function fetchRegions(): Promise<PsgcEntity[]> {
    return getJson('/regions/');
}

export function fetchProvinces(regionCode: string): Promise<PsgcEntity[]> {
    return getJson(`/regions/${regionCode}/provinces/`);
}

export function fetchCitiesMunicipalitiesByProvince(provinceCode: string): Promise<PsgcEntity[]> {
    return getJson(`/provinces/${provinceCode}/cities-municipalities/`);
}

export function fetchCitiesMunicipalitiesByRegion(regionCode: string): Promise<PsgcEntity[]> {
    return getJson(`/regions/${regionCode}/cities-municipalities/`);
}
