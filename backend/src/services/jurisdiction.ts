import { reverseGeocode } from '../lib/nominatim';
import {
    fetchRegions, fetchProvinces, fetchCitiesMunicipalitiesByProvince, fetchDistricts,
    findBestMatch, NCR_REGION_CODE,
} from '../lib/psgc';

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

    const regionCandidates = [address.state, address.region].filter((v): v is string => Boolean(v));
    const provinceCandidates = [address.state_district, address.county].filter((v): v is string => Boolean(v));
    const municipalityCandidates = [address.city, address.town, address.municipality, address.county]
        .filter((v): v is string => Boolean(v));
    const districtCandidates = [address.city_district, address.borough, address.suburb]
        .filter((v): v is string => Boolean(v));

    const regions = await fetchRegions();
    const region = findBestMatch(regionCandidates, regions);
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
    if (!province) return unassigned(displayName);

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
