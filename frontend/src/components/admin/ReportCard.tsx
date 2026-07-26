import { MapPin, Clock, ImageOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { TrashReport } from '@/components/map/TrashMap';

type ReportCardProps = {
    report: TrashReport;
    onClick: () => void;
};

const STATUS_CLASSES: Record<TrashReport['status'], string> = {
    resolved: 'bg-primary-light/20 text-primary-dark',
    flagged: 'bg-secondary-light/30 text-secondary-dark',
    unresolved: 'bg-light-dark text-dark-light',
};

function timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export default function ReportCard({ report, onClick }: ReportCardProps) {
    const thumbnail = report.imageUrls?.[0];

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex gap-3 rounded-xl border border-light-dark bg-white p-3 text-left hover:border-primary hover:shadow-md transition-all"
        >
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
                            report.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-secondary-light/30 text-secondary-dark'
                        )}
                    >
                        {report.severity}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', STATUS_CLASSES[report.status])}>
                        {report.status}
                    </span>
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
        </button>
    );
}
