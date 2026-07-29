import { reverseGeocode } from '../lib/nominatim';
import {
    fetchRegions, fetchProvinces, fetchCitiesMunicipalitiesByProvince, fetchCitiesMunicipalitiesByRegion,
    fetchDistricts, findBestMatch, normalizeName, NCR_REGION_CODE,
} from '../lib/psgc';

// Nominatim calls NCR "Metro Manila"; PSGC calls it "NCR" — normalizeName alone won't bridge that.
const NCR_ALIASES = new Set(['ncr', 'metro manila', 'national capital region']);

export class NotInPhilippinesError extends Error {
    constructor() {
        super('This service only accepts reports within the Philippines.');
        this.name = 'NotInPhilippinesError';
    }
}

export interface JurisdictionResult {
    jurisdictionStatus: 'ASSIGNED' | 'UNASSIGNED';
    locationLabel: string;
    regionCode: string | null;
    regionName: string | null;
    provinceCode: string | null;
    provinceName: string | null;
    municipalityCode: string | null;
    municipalityName: string | null;
}

function unassigned(locationLabel: string): JurisdictionResult {
    return {
        jurisdictionStatus: 'UNASSIGNED', locationLabel,
        regionCode: null, regionName: null,
        provinceCode: null, provinceName: null,
        municipalityCode: null, municipalityName: null,
    };
}

export async function resolveJurisdiction(lat: number, lng: number): Promise<JurisdictionResult> {
    const { address, displayName } = await reverseGeocode(lat, lng);
    if (address.country_code?.toLowerCase() !== 'ph') {
        throw new NotInPhilippinesError();
    }

    // Nominatim's PH data puts the region name in `region` and the province name in `state`
    // (not the other way around, despite "state" sounding region-level).
    const regionCandidates = [address.region, address.state].filter((v): v is string => Boolean(v));
    const provinceCandidates = [address.state, address.state_district, address.county].filter((v): v is string => Boolean(v));
    const municipalityCandidates = [address.city, address.town, address.municipality, address.county]
        .filter((v): v is string => Boolean(v));
    const districtCandidates = [address.city_district, address.borough, address.suburb]
        .filter((v): v is string => Boolean(v));

    const regions = await fetchRegions();
    const isNcrCandidate = regionCandidates.some((c) => NCR_ALIASES.has(normalizeName(c)));
    const region = isNcrCandidate
        ? regions.find((r) => r.code === NCR_REGION_CODE) ?? null
        : findBestMatch(regionCandidates, regions);
    if (!region) return unassigned(displayName);

    // NCR has no provinces — its second-level unit is a district, not a province.
    if (region.code === NCR_REGION_CODE) {
        const districts = await fetchDistricts(region.code);
        const district = findBestMatch(districtCandidates, districts);
        if (!district) return unassigned(displayName);
        return {
            jurisdictionStatus: 'ASSIGNED', locationLabel: displayName,
            regionCode: region.code, regionName: region.name,
            provinceCode: null, provinceName: null,
            municipalityCode: district.code, municipalityName: district.name,
        };
    }

    const provinces = await fetchProvinces(region.code);
    const province = findBestMatch(provinceCandidates, provinces);

    if (!province) {
        // No province match (e.g. an independent city like Cebu City or Manila that Nominatim
        // doesn't tag with a province) — try matching the municipality directly under the region.
        const municipalities = await fetchCitiesMunicipalitiesByRegion(region.code);
        const municipality = findBestMatch(municipalityCandidates, municipalities);
        if (!municipality) return unassigned(displayName);
        return {
            jurisdictionStatus: 'ASSIGNED', locationLabel: displayName,
            regionCode: region.code, regionName: region.name,
            provinceCode: null, provinceName: null,
            municipalityCode: municipality.code, municipalityName: municipality.name,
        };
    }

    const municipalities = await fetchCitiesMunicipalitiesByProvince(province.code);
    const municipality = findBestMatch(municipalityCandidates, municipalities);
    if (!municipality) return unassigned(displayName);

    return {
        jurisdictionStatus: 'ASSIGNED', locationLabel: displayName,
        regionCode: region.code, regionName: region.name,
        provinceCode: province.code, provinceName: province.name,
        municipalityCode: municipality.code, municipalityName: municipality.name,
    };
}
