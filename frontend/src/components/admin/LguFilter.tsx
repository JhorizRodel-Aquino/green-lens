import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TrashReport } from '@/components/map/TrashMap';
import { jurisdictionLabel } from '@/utils/reportStats';
import { cn } from '@/utils/cn';
import { useClickOutside } from '@/utils/useClickOutside';
import { apiFetch } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import { useJurisdictionCoverage } from '@/components/admin/useJurisdictionCoverage';

export const ALL_LGUS = '__all__';
export const NO_LGU_COVERAGE = '__no_coverage__';

/** Scopes `reports` down to one LGU (municipality/city), or to reports no LGU/ADMIN account covers.
 * LGU options come from actual LGU Agent accounts, not from every jurisdiction reports happen to fall in.
 * An LGU Agent already only sees their own municipality server-side, so no filter for them.
 * The "no coverage" option is a super-admin concern (visibility into unassigned jurisdictions), so it's
 * only offered when `includeNoCoverage` is true. */
export function useLguFilter(reports: TrashReport[], includeNoCoverage: boolean) {
    const { user } = useAuth();
    const { isOrphaned } = useJurisdictionCoverage();
    const [selectedLgu, setSelectedLgu] = useState(ALL_LGUS);
    const [lguNames, setLguNames] = useState<string[]>([]);

    useEffect(() => {
        if (user?.role === 'LGU_AGENT') {
            setLguNames([]);
            return;
        }
        apiFetch<{ role: string; municipalityName: string | null }[]>('/api/users')
            .then((users) => {
                const names = users
                    .filter((u) => u.role === 'LGU_AGENT' && u.municipalityName)
                    .map((u) => u.municipalityName as string);
                setLguNames([...new Set(names)].sort());
            })
            .catch(() => setLguNames([]));
    }, [user?.role]);

    const lguOptions = includeNoCoverage && lguNames.length > 0 ? [...lguNames, NO_LGU_COVERAGE] : lguNames;

    const filteredReports = useMemo(() => {
        if (selectedLgu === ALL_LGUS) return reports;
        if (selectedLgu === NO_LGU_COVERAGE) return reports.filter(isOrphaned);
        return reports.filter((r) => jurisdictionLabel(r) === selectedLgu);
    }, [reports, selectedLgu, isOrphaned]);

    return { selectedLgu, setSelectedLgu, lguOptions, filteredReports };
}

type LguFilterProps = {
    value: string;
    onChange: (value: string) => void;
    options: string[];
};

const ALL_LABEL = 'All LGUs';
const NO_COVERAGE_LABEL = 'No LGU Coverage';

export default function LguFilter({ value, onChange, options }: LguFilterProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false));

    if (options.length <= 1) return null;

    const labelFor = (v: string) => (v === NO_LGU_COVERAGE ? NO_COVERAGE_LABEL : v);
    const displayValue = value === ALL_LGUS ? ALL_LABEL : labelFor(value);
    const filtered = options.filter((name) => labelFor(name).toLowerCase().includes(search.toLowerCase()));

    const select = (v: string) => {
        onChange(v);
        setOpen(false);
        setSearch('');
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center justify-between gap-2 w-48 rounded-lg border border-light-dark bg-white px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary"
            >
                <span className="truncate">{displayValue}</span>
                <ChevronDown size={14} className="shrink-0 text-dark-light" />
            </button>

            {open && (
                <div className="absolute right-0 z-[1100] mt-1 w-56 rounded-lg border border-light-dark bg-white shadow-lg overflow-hidden">
                    <input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search LGU..."
                        className="w-full border-b border-light-dark px-3 py-2 text-sm focus:outline-none"
                    />
                    <div className="max-h-56 overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => select(ALL_LGUS)}
                            className={cn('w-full text-left px-3 py-2 text-sm hover:bg-light', value === ALL_LGUS && 'bg-light font-medium')}
                        >
                            {ALL_LABEL}
                        </button>
                        {filtered.map((name) => (
                            <button
                                key={name}
                                type="button"
                                onClick={() => select(name)}
                                className={cn('w-full text-left px-3 py-2 text-sm hover:bg-light truncate', value === name && 'bg-light font-medium')}
                                title={labelFor(name)}
                            >
                                {labelFor(name)}
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="px-3 py-2 text-sm text-dark-light">No matches.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
