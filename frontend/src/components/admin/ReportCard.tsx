import { MapPin, Clock, ImageOff, MapPinOff, ShieldAlert, RotateCcw, UserX } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FLAG_REASON_LABELS, REPORT_STATUS_LABELS, type TrashReport } from '@/components/map/TrashMap';
import { SEVERITY_BADGE_CLASSES } from '@/config/severity';

type ReportCardProps = {
    report: TrashReport;
    onClick: () => void;
    orphaned?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
    selectionDisabled?: boolean;
};

const STATUS_CLASSES: Record<TrashReport['status'], string> = {
    resolved: 'bg-primary-light/20 text-primary-dark',
    flagged: 'bg-secondary-light/30 text-secondary-dark',
    unresolved: 'bg-light-dark text-dark-light',
    pending: 'bg-yellow-100 text-yellow-700',
};

function timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export default function ReportCard({ report, onClick, orphaned, selected, onToggleSelect, selectionDisabled }: ReportCardProps) {
    const thumbnail = report.imageUrls?.[0];

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            className="relative flex gap-3 rounded-xl border border-light-dark bg-white p-3 text-left hover:border-primary hover:shadow-md transition-all cursor-pointer"
        >
            {onToggleSelect && (
                <input
                    type="checkbox"
                    checked={!!selected}
                    disabled={!selected && selectionDisabled}
                    onChange={onToggleSelect}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select report at ${report.locationLabel ?? 'unknown location'} for route`}
                    title={!selected && selectionDisabled ? 'Route limit reached (10 max)' : undefined}
                    className="absolute right-2 top-2 h-4 w-4 rounded border-light-dark text-primary accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
                />
            )}

            <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-light flex items-center justify-center">
                {thumbnail ? (
                    <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                    <ImageOff size={20} className="text-dark-light" />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            SEVERITY_BADGE_CLASSES[report.severity]
                        )}
                    >
                        {report.severity}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', STATUS_CLASSES[report.status])}>
                        {REPORT_STATUS_LABELS[report.status]}
                    </span>
                    {report.status === 'flagged' && report.flagReason && (
                        <span className="flex items-center gap-1 rounded-full bg-secondary-light/30 px-2 py-0.5 text-[11px] font-semibold text-secondary-dark">
                            <ShieldAlert size={11} />
                            {FLAG_REASON_LABELS[report.flagReason]}
                        </span>
                    )}
                    {report.wasReopened && (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                            <RotateCcw size={11} />
                            Reopened
                        </span>
                    )}
                    {report.jurisdictionStatus === 'UNASSIGNED' && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            <MapPinOff size={11} />
                            Unassigned
                        </span>
                    )}
                    {orphaned && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            <UserX size={11} />
                            No LGU Coverage
                        </span>
                    )}
                </div>

                <p className="text-sm text-dark truncate">{report.details}</p>

                <div className="mt-1 flex items-center gap-3 text-xs text-dark-light">
                    <span className="flex items-center gap-1 truncate">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{report.locationLabel ?? 'Unknown location'}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                        <Clock size={12} />
                        {timeAgo(report.createdAt)}
                    </span>
                </div>
            </div>
        </div>
    );
}
