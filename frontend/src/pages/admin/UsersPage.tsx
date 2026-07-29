import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { UserPlus, ShieldCheck, Users as UsersIcon, MapPin, Ban, CheckCircle2, Pencil, Copy, KeyRound } from 'lucide-react';
import { cn } from '@/utils/cn';
import { apiFetch } from '@/utils/api';
import Offcanvas from '@/components/ui/Offcanvas';
import {
    fetchRegions, fetchProvinces, fetchCitiesMunicipalities,
    type PsgcRegion, type PsgcProvince, type PsgcCityMunicipality,
} from '@/utils/psgc';

type BackendRole = 'ADMIN' | 'LGU_AGENT';
type BackendStatus = 'ACTIVE' | 'BLOCKED';

interface ApiUser {
    id: string;
    name: string;
    email: string;
    role: BackendRole;
    status: BackendStatus;
    regionCode: string | null;
    regionName: string | null;
    provinceCode: string | null;
    provinceName: string | null;
    municipalityCode: string | null;
    municipalityName: string | null;
}

const ENTIRE = ''; // sentinel: jurisdiction stops at the parent level

const ROLE_LABELS: Record<BackendRole, string> = { ADMIN: 'Admin', LGU_AGENT: 'LGU Agent' };
const STATUS_STYLES: Record<BackendStatus, string> = {
    ACTIVE: 'bg-primary-light/20 text-primary-dark',
    BLOCKED: 'bg-red-100 text-red-600',
};
const STATUS_DOT: Record<BackendStatus, string> = { ACTIVE: 'bg-primary', BLOCKED: 'bg-red-600' };

function jurisdictionLabelFor(user: ApiUser): string {
    if (!user.regionName) return 'Entire Philippines';
    if (user.municipalityName) {
        return user.provinceName
            ? `${user.municipalityName}, ${user.provinceName}, ${user.regionName}`
            : `${user.municipalityName}, ${user.regionName}`;
    }
    if (user.provinceName) return `Entire ${user.provinceName}, ${user.regionName}`;
    return `Entire ${user.regionName}`;
}

export default function UsersPage() {
    const [users, setUsers] = useState<ApiUser[]>([]);
    const [loadError, setLoadError] = useState('');

    const [panelOpen, setPanelOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [revealedPassword, setRevealedPassword] = useState('');

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<BackendRole>('LGU_AGENT');

    const [regions, setRegions] = useState<PsgcRegion[]>([]);
    const [provinces, setProvinces] = useState<PsgcProvince[]>([]);
    const [municipalities, setMunicipalities] = useState<PsgcCityMunicipality[]>([]);

    const [regionCode, setRegionCode] = useState('');
    const [provinceCode, setProvinceCode] = useState(ENTIRE);
    const [municipalityCode, setMunicipalityCode] = useState(ENTIRE);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingMunicipalities, setLoadingMunicipalities] = useState(false);

    function loadUsers() {
        apiFetch<ApiUser[]>('/api/users').then(setUsers).catch((err) => setLoadError(err.message));
    }

    useEffect(loadUsers, []);

    useEffect(() => {
        fetchRegions().then(setRegions).catch(() => setRegions([]));
    }, []);

    // Fetches provinces whenever regionCode changes (user pick or prefill). Does NOT
    // touch provinceCode/municipalityCode — callers reset those explicitly when it's
    // a real user change, so prefilling an edit can set all three without a race.
    useEffect(() => {
        if (!regionCode) {
            setProvinces([]);
            setMunicipalities([]);
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

    // Fetches municipalities whenever provinceCode changes. Same no-side-effect rule as above.
    useEffect(() => {
        if (!provinceCode) return;
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
        admins: users.filter((u) => u.role === 'ADMIN').length,
        agents: users.filter((u) => u.role === 'LGU_AGENT').length,
    }), [users]);

    function resetForm() {
        setName('');
        setEmail('');
        setRole('LGU_AGENT');
        setRegionCode('');
        setProvinceCode(ENTIRE);
        setMunicipalityCode(ENTIRE);
        setSubmitError('');
        setRevealedPassword('');
    }

    function openCreatePanel() {
        resetForm();
        setEditingUser(null);
        setPanelOpen(true);
    }

    function openEditPanel(user: ApiUser) {
        resetForm();
        setEditingUser(user);
        setName(user.name);
        setEmail(user.email);
        setRole(user.role);
        setRegionCode(user.regionCode ?? '');
        setProvinceCode(user.provinceCode ?? ENTIRE);
        setMunicipalityCode(user.municipalityCode ?? ENTIRE);
        setPanelOpen(true);
    }

    function closePanel() {
        setPanelOpen(false);
        setEditingUser(null);
    }

    function onRegionChange(code: string) {
        setRegionCode(code);
        setProvinceCode(ENTIRE);
        setMunicipalityCode(ENTIRE);
    }

    function onProvinceChange(code: string) {
        setProvinceCode(code);
        setMunicipalityCode(ENTIRE);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !selectedRegion) return;

        setSubmitting(true);
        setSubmitError('');
        const payload = {
            name: name.trim(),
            email: email.trim(),
            role,
            regionCode: selectedRegion.code,
            regionName: selectedRegion.name,
            provinceCode: selectedProvince?.code ?? null,
            provinceName: selectedProvince?.name ?? null,
            municipalityCode: selectedMunicipality?.code ?? null,
            municipalityName: selectedMunicipality?.name ?? null,
        };

        try {
            if (editingUser) {
                await apiFetch(`/api/users/${editingUser.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
                closePanel();
                loadUsers();
            } else {
                const created = await apiFetch<ApiUser & { tempPassword: string }>('/api/users', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                setRevealedPassword(created.tempPassword);
                loadUsers();
            }
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to save account');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleResetPassword() {
        if (!editingUser) return;
        setSubmitting(true);
        setSubmitError('');
        try {
            const result = await apiFetch<{ tempPassword: string }>(`/api/users/${editingUser.id}/reset-password`, { method: 'POST' });
            setRevealedPassword(result.tempPassword);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to reset password');
        } finally {
            setSubmitting(false);
        }
    }

    async function toggleBlocked(user: ApiUser) {
        const status: BackendStatus = user.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
        await apiFetch(`/api/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
        loadUsers();
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-dark">Authority Management</h1>
                    <p className="text-sm text-dark-light">Create LGU accounts and assign their geographical jurisdiction.</p>
                </div>
                <button
                    type="button"
                    onClick={openCreatePanel}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark active:scale-95 transition-all"
                >
                    <UserPlus size={18} /> Create User
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatTile icon={UsersIcon} label="Total Accounts" value={String(stats.total)} />
                <StatTile icon={ShieldCheck} label="Admins" value={String(stats.admins)} />
                <StatTile icon={MapPin} label="LGU Agents" value={String(stats.agents)} />
            </div>

            {/* Directory */}
            <section className="bg-white border border-light-dark rounded-xl overflow-hidden">
                <div className="p-4 border-b border-light-dark">
                    <h2 className="text-lg font-bold text-dark">User Directory</h2>
                </div>
                {loadError && <p className="p-4 text-xs text-red-600">{loadError}</p>}
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
                                        <span className="text-xs px-3 py-1 bg-light-dark rounded-full text-dark-light font-medium">{ROLE_LABELS[u.role]}</span>
                                    </td>
                                    <td className="p-4 text-sm text-dark">{jurisdictionLabelFor(u)}</td>
                                    <td className="p-4">
                                        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold', STATUS_STYLES[u.status])}>
                                            <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[u.status])} />
                                            {u.status === 'ACTIVE' ? 'Active' : 'Blocked'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openEditPanel(u)}
                                                className="p-1.5 text-primary-dark hover:bg-primary-light/20 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleBlocked(u)}
                                                className={cn(
                                                    'p-1.5 rounded-lg transition-colors',
                                                    u.status === 'BLOCKED' ? 'text-primary-dark hover:bg-primary-light/20' : 'text-red-600 hover:bg-red-100'
                                                )}
                                                title={u.status === 'BLOCKED' ? 'Unblock' : 'Block'}
                                            >
                                                {u.status === 'BLOCKED' ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <Offcanvas open={panelOpen} onClose={closePanel} title={editingUser ? 'Edit Official Account' : 'Create New Official Account'}>
                {revealedPassword ? (
                    <PasswordReveal password={revealedPassword} onDone={closePanel} />
                ) : (
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
                                onChange={(e) => setRole(e.target.value as BackendRole)}
                            >
                                <option value="LGU_AGENT">LGU Agent</option>
                                <option value="ADMIN">Admin</option>
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
                                    onChange={(e) => onRegionChange(e.target.value)}
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
                                        onChange={(e) => onProvinceChange(e.target.value)}
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

                        {submitError && <p className="text-xs text-red-600">{submitError}</p>}

                        <div className="space-y-2">
                            <button
                                type="submit"
                                className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50"
                                disabled={!name.trim() || !email.trim() || !jurisdictionLabel || submitting}
                            >
                                {submitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Register Official Account'}
                            </button>

                            {editingUser && (
                                <button
                                    type="button"
                                    onClick={handleResetPassword}
                                    disabled={submitting}
                                    className="w-full py-3 border border-light-dark text-dark rounded-xl font-bold text-sm hover:bg-light active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <KeyRound size={16} /> Reset Password
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </Offcanvas>
        </div>
    );
}

function PasswordReveal({ password, onDone }: { password: string; onDone: () => void }) {
    const [copied, setCopied] = useState(false);

    function copy() {
        navigator.clipboard.writeText(password).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-dark-light">
                Share this temporary password with the account holder out-of-band. It will not be shown again.
            </p>
            <div className="flex items-center gap-2 bg-light border border-light-dark rounded-lg p-3">
                <code className="flex-1 text-sm font-bold text-dark break-all">{password}</code>
                <button
                    type="button"
                    onClick={copy}
                    className="p-2 text-primary-dark hover:bg-primary-light/20 rounded-lg transition-colors shrink-0"
                    title="Copy"
                >
                    <Copy size={16} />
                </button>
            </div>
            {copied && <p className="text-xs text-primary-dark">Copied to clipboard.</p>}
            <button
                type="button"
                onClick={onDone}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark active:scale-[0.98] transition-all"
            >
                Done
            </button>
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
