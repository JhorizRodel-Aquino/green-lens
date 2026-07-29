// utils/psgc.ts
// PSGC API (https://psgc.gitlab.io/api/) — regions -> provinces -> cities/municipalities

const BASE = 'https://psgc.gitlab.io/api';

export interface PsgcRegion {
    code: string;
    name: string;
}

export interface PsgcProvince {
    code: string;
    name: string;
}

export interface PsgcCityMunicipality {
    code: string;
    name: string;
}

export async function fetchRegions(): Promise<PsgcRegion[]> {
    const res = await fetch(`${BASE}/regions/`);
    if (!res.ok) throw new Error('Failed to load regions');
    return res.json();
}

export async function fetchProvinces(regionCode: string): Promise<PsgcProvince[]> {
    const res = await fetch(`${BASE}/regions/${regionCode}/provinces/`);
    if (!res.ok) throw new Error('Failed to load provinces');
    return res.json();
}

export async function fetchCitiesMunicipalities(provinceCode: string): Promise<PsgcCityMunicipality[]> {
    const res = await fetch(`${BASE}/provinces/${provinceCode}/cities-municipalities/`);
    if (!res.ok) throw new Error('Failed to load cities/municipalities');
    return res.json();
}

export const NCR_REGION_CODE = '130000000';

/** NCR has no provinces — its hierarchy is region -> district -> city/municipality. */
export async function fetchDistricts(regionCode: string): Promise<PsgcCityMunicipality[]> {
    const res = await fetch(`${BASE}/regions/${regionCode}/districts/`);
    if (!res.ok) throw new Error('Failed to load districts');
    return res.json();
}

export async function fetchCitiesMunicipalitiesByDistrict(districtCode: string): Promise<PsgcCityMunicipality[]> {
    const res = await fetch(`${BASE}/districts/${districtCode}/cities-municipalities/`);
    if (!res.ok) throw new Error('Failed to load cities/municipalities');
    return res.json();
}
