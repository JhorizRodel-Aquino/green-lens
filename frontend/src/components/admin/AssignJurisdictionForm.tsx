import { useEffect, useState } from 'react';
import {
    fetchRegions, fetchProvinces, fetchCitiesMunicipalities, fetchDistricts, fetchCitiesMunicipalitiesByDistrict, NCR_REGION_CODE,
    type PsgcRegion, type PsgcProvince, type PsgcCityMunicipality,
} from '@/utils/psgc';
import type { AssignJurisdictionPayload } from '@/utils/reportsApi';
import { Button } from '@/components/ui/Button';

const ENTIRE = '';

type Props = {
    onAssign: (payload: AssignJurisdictionPayload) => Promise<void>;
};

export default function AssignJurisdictionForm({ onAssign }: Props) {
    const [regions, setRegions] = useState<PsgcRegion[]>([]);
    const [provinces, setProvinces] = useState<PsgcProvince[]>([]);
    const [municipalities, setMunicipalities] = useState<PsgcCityMunicipality[]>([]);
    const [regionCode, setRegionCode] = useState('');
    const [provinceCode, setProvinceCode] = useState(ENTIRE);
    const [municipalityCode, setMunicipalityCode] = useState(ENTIRE);
    const [submitting, setSubmitting] = useState(false);

    const isNCR = regionCode === NCR_REGION_CODE;
    const selectedRegion = regions.find((r) => r.code === regionCode);
    const selectedProvince = provinces.find((p) => p.code === provinceCode);
    const selectedMunicipality = municipalities.find((m) => m.code === municipalityCode);

    useEffect(() => {
        fetchRegions().then(setRegions).catch(() => setRegions([]));
    }, []);

    useEffect(() => {
        if (!regionCode) { setProvinces([]); return; }
        (isNCR ? fetchDistricts(regionCode) : fetchProvinces(regionCode))
            .then(setProvinces)
            .catch(() => setProvinces([]));
    }, [regionCode, isNCR]);

    useEffect(() => {
        if (!provinceCode) { setMunicipalities([]); return; }
        (isNCR ? fetchCitiesMunicipalitiesByDistrict(provinceCode) : fetchCitiesMunicipalities(provinceCode))
            .then(setMunicipalities)
            .catch(() => setMunicipalities([]));
    }, [provinceCode, isNCR]);

    function onRegionChange(code: string) {
        setRegionCode(code);
        setProvinceCode(ENTIRE);
        setMunicipalityCode(ENTIRE);
    }

    function onProvinceChange(code: string) {
        setProvinceCode(code);
        setMunicipalityCode(ENTIRE);
    }

    async function handleSubmit() {
        if (!selectedRegion) return;
        setSubmitting(true);
        try {
            await onAssign({
                regionCode: selectedRegion.code,
                regionName: selectedRegion.name,
                provinceCode: selectedProvince?.code ?? null,
                provinceName: selectedProvince?.name ?? null,
                municipalityCode: selectedMunicipality?.code ?? null,
                municipalityName: selectedMunicipality?.name ?? null,
            });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-3">
            <select
                className="w-full bg-white border border-light-dark rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={regionCode}
                onChange={(e) => onRegionChange(e.target.value)}
            >
                <option value="" disabled>Choose region...</option>
                {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>

            {regionCode && (
                <select
                    className="w-full bg-white border border-light-dark rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={provinceCode}
                    onChange={(e) => onProvinceChange(e.target.value)}
                >
                    <option value={ENTIRE}>{isNCR ? 'Entire region' : 'Entire region'}</option>
                    {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
            )}

            {regionCode && provinceCode && (
                <select
                    className="w-full bg-white border border-light-dark rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={municipalityCode}
                    onChange={(e) => setMunicipalityCode(e.target.value)}
                >
                    <option value={ENTIRE}>{isNCR ? 'Entire district' : 'Entire province'}</option>
                    {municipalities.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
                </select>
            )}

            <Button variant="primary" size="sm" disabled={!selectedRegion || submitting} onClick={handleSubmit}>
                Assign Jurisdiction
            </Button>
        </div>
    );
}
