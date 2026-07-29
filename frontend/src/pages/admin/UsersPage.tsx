import { useEffect, useMemo, useState } from 'react';
import { UserPlus, ShieldCheck, Users as UsersIcon, MapPin, Pencil, Ban } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
    fetchRegions, fetchProvinces, fetchCitiesMunicipalities,
    type PsgcRegion, type PsgcProvince, type PsgcCityMunicipality,
} from '@/utils/psgc';

type Role = 'LGU Agent' | 'Admin';
type Status = 'Active' | 'Pending';

interface LguUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    jurisdiction: string;
    status: Status;
}

const ENTIRE = ''; // sentinel: jurisdiction stops at the parent level

const INITIAL_USERS: LguUser[] = [
    { id: '1', name: 'Juan Dela Cruz', email: 'j.delacruz@gov.ph', role: 'LGU Agent', jurisdiction: 'Quezon City, NCR', status: 'Active' },
    { id: '2', name: 'Alicia Mercado', email: 'a.mercado@gov.ph', role: 'LGU Agent', jurisdiction: 'Cebu, Region VII', status: 'Active' },
    { id: '3', name: 'Ricardo Santos', email: 'r.santos@gov.ph', role: 'Admin', jurisdiction: 'Entire Region XI - Davao Region', status: 'Pending' },
];

export default function UsersPage() {
    const [users, setUsers] = useState<LguUser[]>(INITIAL_USERS);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('LGU Agent');

    const [regions, setRegions] = useState<PsgcRegion[]>([]);
    const [provinces, setProvinces] = useState<PsgcProvince[]>([]);
    const [municipalities, setMunicipalities] = useState<PsgcCityMunicipality[]>([]);

    const [regionCode, setRegionCode] = useState('');
    const [provinceCode, setProvinceCode] = useState(ENTIRE);
    const [municipalityCode, setMunicipalityCode] = useState(ENTIRE);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingMunicipalities, setLoadingMunicipalities] = useState(false);

    useEffect(() => {
        fetchRegions().then(setRegions).catch(() => setRegions([]));
    }, []);

    // Region change -> load its provinces (NCR-style regions have none; fall back to region-level cities/municipalities)
    useEffect(() => {
        setProvinceCode(ENTIRE);
        setMunicipalityCode(ENTIRE);
        setMunicipalities([]);
        if (!regionCode) {
            setProvinces([]);
            return;
        }
        setLoadingProvinces(true);
        fetchProvinces(regionCode)
            .then(async (provs) => {
                setProvinces(provs);
                if (provs.length === 0) {
                    // no provinces under this region (e.g. NCR) -> municipalities sit directly under the region
                    setLoadingMunicipalities(true);
                    const munis = await fetchCitiesMunicipalities(regionCode).catch(() => []);
                    setMunicipalities(munis);
                    setLoadingMunicipalities(false);
                }
            })
            .catch(() => setProvinces([]))
            .finally(() => setLoadingProvinces(false));
    }, [regionCode]);

    // Province change -> load its municipalities
    useEffect(() => {
        setMunicipalityCode(ENTIRE);
        if (!provinceCode) {
            setMunicipalities([]);
            return;
        }
        setLoadingMunicipalities(true);
        fetchCitiesMunicipalities(provinceCode)
            .then(setMunicipalities)
            .catch(() => setMunicipalities([]))
            .finally(() => setLoadingMunicipalities(false));
    }, [provinceCode]);

    const selectedRegion = regions.find((r) => r.code === regionCode);
    const selectedProvince = provinces.find((p) => p.code === provinceCode);
    const selectedMunicipality = municipalities.find((m) => m.code === municipalityCode);
    const regionHasNoProvinces = regionCode !== '' && !loadingProvinces && provinces.length === 0;

    const jurisdictionLabel = useMemo(() => {
        if (!selectedRegion) return '';
        if (selectedMunicipality) {
            return regionHasNoProvinces
                ? `${selectedMunicipality.name}, ${selectedRegion.name}`
                : `${selectedMunicipality.name}, ${selectedProvince?.name}, ${selectedRegion.name}`;
        }
        if (selectedProvince) return `Entire ${selectedProvince.name}, ${selectedRegion.name}`;
        return `Entire ${selectedRegion.name}`;
    }, [selectedRegion, selectedProvince, selectedMunicipality, regionHasNoProvinces]);

    const stats = useMemo(() => ({
        total: users.length,
        admins: users.filter((u) => u.role === 'Admin').length,
        agents: users.filter((u) => u.role === 'LGU Agent').length,
    }), [users]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !jurisdictionLabel) return;

        setUsers((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name: name.trim(), email: email.trim(), role, jurisdiction: jurisdictionLabel, status: 'Pending' },
        ]);

        setName('');
        setEmail('');
        setRole('LGU Agent');
        setRegionCode('');
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-dark">Authority Management</h1>
                <p className="text-sm text-dark-light">Create LGU accounts and assign their geographical jurisdiction.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatTile icon={UsersIcon} label="Total Accounts" value={String(stats.total)} />
                <StatTile icon={ShieldCheck} label="Admins" value={String(stats.admins)} />
                <StatTile icon={MapPin} label="LGU Agents" value={String(stats.agents)} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Create account form */}
                <section className="xl:col-span-5 bg-white border border-light-dark rounded-xl p-4 md:p-6">
                    <div className="flex items-center gap-3 mb-6 border-b border-light-dark pb-4">
                        <div className="bg-primary-light/20 p-2 rounded-lg">
                            <UserPlus size={20} className="text-primary-dark" />
                        </div>
                        <h2 className="text-lg font-bold text-dark">Create New Official Account</h2>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <Field label="Full Name">
                            <input
                                className="w-full bg-light border border-light-dark rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="e.g. Maria Clara de la Cruz"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </Field>

                        <Field label="Official Email">
                            <input
                                type="email"
                                className="w-full bg-light border border-light-dark rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="maria.cruz@gov.ph"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </Field>

                        <Field label="Role Assignment">
                            <select
                                className="w-full bg-light border border-light-dark rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                value={role}
                                onChange={(e) => setRole(e.target.value as Role)}
                            >
                                <option value="LGU Agent">LGU Agent</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </Field>

                        <div className="space-y-4 pt-4 border-t border-light-dark">
                            <h3 className="text-xs font-bold text-primary-dark uppercase tracking-wide flex items-center gap-2">
                                <MapPin size={14} /> Jurisdiction Assignment
                            </h3>

                            <Field label="Step 1: Region (required)">
                                <select
                                    className="w-full bg-light border border-light-dark rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={regionCode}
                                    onChange={(e) => setRegionCode(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Choose region...</option>
                                    {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                                </select>
                            </Field>

                            {regionCode && !regionHasNoProvinces && (
                                <Field label="Step 2: Province (optional — leave blank for entire region)">
                                    <select
                                        className="w-full bg-light border border-light-dark rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                        value={provinceCode}
                                        onChange={(e) => setProvinceCode(e.target.value)}
                                        disabled={loadingProvinces}
                                    >
                                        <option value={ENTIRE}>Entire region</option>
                                        {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                                    </select>
                                </Field>
                            )}

                            {regionCode && (provinceCode || regionHasNoProvinces) && (
                                <Field label="Step 3: Municipality/City (optional — leave blank for entire province)">
                                    <select
                                        className="w-full bg-light border border-light-dark rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                        value={municipalityCode}
                                        onChange={(e) => setMunicipalityCode(e.target.value)}
                                        disabled={loadingMunicipalities}
                                    >
                                        <option value={ENTIRE}>{regionHasNoProvinces ? 'Entire region' : 'Entire province'}</option>
                                        {municipalities.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
                                    </select>
                                </Field>
                            )}

                            {jurisdictionLabel && (
                                <p className="text-xs text-dark-light bg-light rounded-lg p-3">
                                    Jurisdiction: <span className="font-bold text-dark">{jurisdictionLabel}</span>
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50"
                            disabled={!name.trim() || !email.trim() || !jurisdictionLabel}
                        >
                            Register Official Account
                        </button>
                    </form>
                </section>

                {/* Directory */}
                <section className="xl:col-span-7 bg-white border border-light-dark rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-light-dark">
                        <h2 className="text-lg font-bold text-dark">User Directory</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-light border-b border-light-dark">
                                <tr>
                                    <th className="p-4 text-xs font-bold text-dark-light">Name &amp; Email</th>
                                    <th className="p-4 text-xs font-bold text-dark-light">Role</th>
                                    <th className="p-4 text-xs font-bold text-dark-light">Jurisdiction</th>
                                    <th className="p-4 text-xs font-bold text-dark-light">Status</th>
                                    <th className="p-4 text-xs font-bold text-dark-light text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-light-dark">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-light transition-colors">
                                        <td className="p-4">
                                            <p className="text-sm font-bold text-dark">{u.name}</p>
                                            <p className="text-xs text-dark-light">{u.email}</p>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs px-3 py-1 bg-light-dark rounded-full text-dark-light font-medium">{u.role}</span>
                                        </td>
                                        <td className="p-4 text-sm text-dark">{u.jurisdiction}</td>
                                        <td className="p-4">
                                            <span className={cn(
                                                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold',
                                                u.status === 'Active' ? 'bg-primary-light/20 text-primary-dark' : 'bg-secondary-light/30 text-secondary-dark'
                                            )}>
                                                <span className={cn('w-1.5 h-1.5 rounded-full', u.status === 'Active' ? 'bg-primary' : 'bg-secondary')} />
                                                {u.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button type="button" className="p-1.5 text-primary-dark hover:bg-primary-light/20 rounded-lg transition-colors">
                                                    <Pencil size={16} />
                                                </button>
                                                <button type="button" className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                                                    <Ban size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-semibold text-dark-light">{label}</label>
            {children}
        </div>
    );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof UsersIcon; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-light-dark bg-white p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light/20 text-primary-dark">
                <Icon size={20} />
            </div>
            <div>
                <p className="text-xs font-medium text-dark-light">{label}</p>
                <p className="text-xl font-bold text-dark">{value}</p>
            </div>
        </div>
    );
}
