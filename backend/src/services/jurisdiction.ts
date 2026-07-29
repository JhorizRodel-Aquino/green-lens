import { reverseGeocode } from '../lib/nominatim';
import {
    fetchRegions, fetchProvinces, fetchCitiesMunicipalitiesByProvince, fetchCitiesMunicipalitiesByRegion,
    findBestMatch,
} from '../lib/psgc';

export class NotInPhilippinesError extends Error {
    constructor() {
        super('This service only accepts reports within the Philippines.');
        this.name = 'NotInPhilippinesError';
    }
}

export interface JurisdictionResult {
    jurisdictionStatus: 'ASSIGNED' | 'UNASSIGNED';
    regionCode: string | null;
    regionName: string | null;
    provinceCode: string | null;
    provinceName: string | null;
    municipalityCode: string | null;
    municipalityName: string | null;
}

const UNASSIGNED: JurisdictionResult = {
    jurisdictionStatus: 'UNASSIGNED',
    regionCode: null, regionName: null,
    provinceCode: null, provinceName: null,
    municipalityCode: null, municipalityName: null,
};

export async function resolveJurisdiction(lat: number, lng: number): Promise<JurisdictionResult> {
    const address = await reverseGeocode(lat, lng);
    if (address.country_code?.toLowerCase() !== 'ph') {
        throw new NotInPhilippinesError();
    }

    const regionCandidates = [address.state, address.region].filter((v): v is string => Boolean(v));
    const provinceCandidates = [address.state_district, address.county].filter((v): v is string => Boolean(v));
    const municipalityCandidates = [address.city, address.town, address.municipality, address.county]
        .filter((v): v is string => Boolean(v));

    const regions = await fetchRegions();
    const region = findBestMatch(regionCandidates, regions);
    if (!region) return UNASSIGNED;

    const provinces = await fetchProvinces(region.code);

    if (provinces.length === 0) {
        // Region has no provinces (e.g. NCR) — municipalities sit directly under the region.
        const municipalities = await fetchCitiesMunicipalitiesByRegion(region.code);
        const municipality = findBestMatch(municipalityCandidates, municipalities);
        if (!municipality) return UNASSIGNED;
        return {
            jurisdictionStatus: 'ASSIGNED',
            regionCode: region.code, regionName: region.name,
            provinceCode: null, provinceName: null,
            municipalityCode: municipality.code, municipalityName: municipality.name,
        };
    }

    const province = findBestMatch(provinceCandidates, provinces);
    if (!province) return UNASSIGNED;

    const municipalities = await fetchCitiesMunicipalitiesByProvince(province.code);
    const municipality = findBestMatch(municipalityCandidates, municipalities);
    if (!municipality) return UNASSIGNED;

    return {
        jurisdictionStatus: 'ASSIGNED',
        regionCode: region.code, regionName: region.name,
        provinceCode: province.code, provinceName: province.name,
        municipalityCode: municipality.code, municipalityName: municipality.name,
    };
}
