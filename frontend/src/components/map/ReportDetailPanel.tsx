import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MapPin, ImageOff, CircleCheck, Flag, ChevronDown, ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { SEVERITY_BADGE } from '@/config/severity';
import { useReports } from '@/context/ReportsContext';
import { useNotifications } from '@/components/ui/Notifications';
import { FLAG_REASON_LABELS, type FlagReasonCode } from './TrashMap';
import { SEVERITY_BADGE_CLASSES } from '@/config/severity';
import ImageLightbox from './ImageLightbox';
import DirectionsModal from '@/components/admin/DirectionsModal';

type ReportDetailPanelProps = {
    reportId: string;
    onClose: () => void;
};

export default function ReportDetailPanel({ reportId, onClose }: ReportDetailPanelProps) {
    const { reports, acceptReport, flagReport } = useReports();
    const { toast, confirm } = useNotifications();
    const navigate = useNavigate();
    const [flagMenuOpen, setFlagMenuOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [showDirections, setShowDirections] = useState(false);

    const report = reports.find((r) => r.id === reportId);
    const images = report?.imageUrls ?? [];

    if (!report) return null;

    const showPrev = () => setCarouselIndex((i) => (i - 1 + images.length) % images.length);
    const showNext = () => setCarouselIndex((i) => (i + 1) % images.length);

    const handleAccept = async () => {
        try {
            await acceptReport(report.id);
            toast('success', 'Report accepted.');
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Failed to accept report');
        }
    };

    const handleFlag = async (reason: FlagReasonCode) => {
        setFlagMenuOpen(false);
        const ok = await confirm({
            title: 'Flag this report?',
            message: `This marks it as "${FLAG_REASON_LABELS[reason]}" instead of a valid report.`,
            confirmLabel: 'Flag Report',
            tone: 'danger',
        });
        if (!ok) return;

        try {
            await flagReport(report.id, reason);
            toast('success', 'Report flagged.');
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Failed to flag report');
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 z-[1002] flex w-full max-w-md flex-col bg-white shadow-xl border-l border-light-dark">
            <div className="flex items-center justify-between h-16 px-4 border-b border-light-dark shrink-0">
                <h2 className="text-lg font-semibold text-dark">Report Details</h2>
                <button type="button" onClick={onClose} aria-label="Close" className="text-dark-light hover:text-dark">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                    <span
                        className={cn(
                            'inline-block rounded-full px-3 py-1 text-xs font-semibold',
                            SEVERITY_BADGE[report.severity]
                        )}
                    >
                        {report.severity} SEVERITY
                    </span>
                    <span
                        className={cn(
                            'inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize',
                            report.status === 'resolved' && 'bg-primary-light/20 text-primary-dark',
                            report.status === 'flagged' && 'bg-secondary-light/30 text-secondary-dark',
                            report.status === 'unresolved' && 'bg-light-dark text-dark-light',
                            report.status === 'pending' && 'bg-yellow-100 text-yellow-700'
                        )}
                    >
                        {report.status}
                    </span>
                </div>

                {images.length > 0 ? (
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-light-dark bg-light group">
                        <button
                            type="button"
                            onClick={() => setLightboxIndex(carouselIndex)}
                            className="absolute inset-0 w-full h-full"
                            aria-label="Expand image"
                        >
                            <img
                                src={images[carouselIndex]}
                                alt={`Report ${carouselIndex + 1} of ${images.length}`}
                                className="h-full w-full object-cover"
                            />
                        </button>

                        <div className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <Expand size={14} />
                        </div>

                        {images.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={showPrev}
                                    aria-label="Previous image"
                                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={showNext}
                                    aria-label="Next image"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                                >
                                    <ChevronRight size={16} />
                                </button>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                                    {images.map((_, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setCarouselIndex(i)}
                                            aria-label={`Go to image ${i + 1}`}
                                            className={cn(
                                                'h-1.5 rounded-full transition-all',
                                                i === carouselIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                                            )}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="aspect-video w-full rounded-lg bg-light border border-light-dark flex items-center justify-center">
                        <div className="flex flex-col items-center gap-1.5 text-dark-light">
                            <ImageOff size={28} />
                            <span className="text-xs">No image provided</span>
                        </div>
                    </div>
                )}

                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-dark-light">GPS Coordinates</p>
                    <button
                        type="button"
                        onClick={() => setShowDirections(true)}
                        className="text-sm text-primary hover:underline mt-0.5"
                    >
                        {report.lat.toFixed(6)}, {report.lng.toFixed(6)}
                    </button>
                </div>

                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-dark-light">Location</p>
                    <p className="text-sm text-dark mt-0.5 flex items-start gap-1.5">
                        <MapPin size={16} className="shrink-0 mt-0.5 text-dark-light" />
                        {report.locationLabel ?? 'Location unavailable'}
                    </p>
                </div>

                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-dark-light">Description</p>
                    <p className="text-sm text-dark mt-0.5">{report.details}</p>
                </div>
            </div>

            <div className="shrink-0 border-t border-light-dark p-4 space-y-2 relative">
                {report.status === 'pending' && (
                    <Button
                        variant="outline"
                        leftIcon={CircleCheck}
                        fullWidth
                        className="rounded-lg"
                        onClick={handleAccept}
                    >
                        Accept
                    </Button>
                )}

                {report.status === 'flagged' ? (
                    <div className="rounded-lg bg-secondary-light/20 px-4 py-3 text-sm text-secondary-dark text-center">
                        This report is flagged and cannot be resolved.
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <Button
                            variant="primary"
                            leftIcon={CircleCheck}
                            fullWidth
                            className="rounded-lg"
                            onClick={() => {
                                onClose();
                                navigate(`/admin/reports/${report.id}`);
                            }}
                        >
                            {report.status === 'resolved' ? 'View Resolution' : 'Resolve'}
                        </Button>

                        <div className="relative shrink-0">
                            <Button
                                variant="outline"
                                rightIcon={ChevronDown}
                                className="rounded-lg whitespace-nowrap"
                                onClick={() => setFlagMenuOpen((v) => !v)}
                            >
                                <Flag size={16} />
                                Flag
                            </Button>

                            {flagMenuOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-56 rounded-lg border border-light-dark bg-white shadow-lg overflow-hidden">
                                    {(Object.keys(FLAG_REASON_LABELS) as FlagReasonCode[]).map((reason, i) => (
                                        <button
                                            key={reason}
                                            type="button"
                                            onClick={() => handleFlag(reason)}
                                            className={cn(
                                                'w-full text-left px-4 py-2.5 text-sm text-dark hover:bg-light',
                                                i > 0 && 'border-t border-light-dark'
                                            )}
                                        >
                                            {FLAG_REASON_LABELS[reason]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {lightboxIndex !== null && (
                <ImageLightbox
                    images={images}
                    startIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onIndexChange={setCarouselIndex}
                />
            )}

            {showDirections && (
                <DirectionsModal lat={report.lat} lng={report.lng} locationLabel={report.locationLabel} onClose={() => setShowDirections(false)} />
            )}
        </div>
    );
}
