import { useState } from 'react';
import { X, MapPin, ImageOff, CircleCheck, Flag, ChevronDown, ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import type { TrashReport } from './AdminTrashMap';
import ImageLightbox from './ImageLightbox';

type ReportDetailPanelProps = {
    report: TrashReport;
    onClose: () => void;
};

export default function ReportDetailPanel({ report, onClose }: ReportDetailPanelProps) {
    const [flagMenuOpen, setFlagMenuOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const images = report.imageUrls ?? [];

    const showPrev = () => setCarouselIndex((i) => (i - 1 + images.length) % images.length);
    const showNext = () => setCarouselIndex((i) => (i + 1) % images.length);

    return (
        <div className="fixed inset-y-0 right-0 z-[1002] flex w-full max-w-sm flex-col bg-white shadow-xl border-l border-light-dark">
            <div className="flex items-center justify-between h-16 px-4 border-b border-light-dark shrink-0">
                <h2 className="text-lg font-semibold text-dark">Report Details</h2>
                <button type="button" onClick={onClose} aria-label="Close" className="text-dark-light hover:text-dark">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <span
                    className={cn(
                        'inline-block rounded-full px-3 py-1 text-xs font-semibold',
                        report.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-secondary-light/30 text-secondary-dark'
                    )}
                >
                    {report.severity} SEVERITY
                </span>

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
                    <p className="text-sm text-dark mt-0.5">{report.lat.toFixed(6)}, {report.lng.toFixed(6)}</p>
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

            <div className="shrink-0 border-t border-light-dark p-4 flex gap-2 relative">
                <Button variant="primary" leftIcon={CircleCheck} fullWidth className="rounded-lg">
                    Resolve
                </Button>

                <div className="relative">
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
                            <button
                                type="button"
                                onClick={() => setFlagMenuOpen(false)}
                                className="w-full text-left px-4 py-2.5 text-sm text-dark hover:bg-light"
                            >
                                False report
                            </button>
                            <button
                                type="button"
                                onClick={() => setFlagMenuOpen(false)}
                                className="w-full text-left px-4 py-2.5 text-sm text-dark hover:bg-light border-t border-light-dark"
                            >
                                Out of our control
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {lightboxIndex !== null && (
                <ImageLightbox
                    images={images}
                    startIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onIndexChange={setCarouselIndex}
                />
            )}
        </div>
    );
}
