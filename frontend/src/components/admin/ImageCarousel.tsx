import { useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import ImageLightbox from '@/components/map/ImageLightbox';

type ImageCarouselProps = {
    images: string[];
    emptyIcon: LucideIcon;
    emptyLabel: string;
};

export default function ImageCarousel({ images, emptyIcon: EmptyIcon, emptyLabel }: ImageCarouselProps) {
    const [index, setIndex] = useState(0);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    if (images.length === 0) {
        return (
            <div className="aspect-video w-full rounded-lg overflow-hidden border border-light-dark bg-light flex items-center justify-center">
                <div className="flex flex-col items-center gap-1.5 text-dark-light">
                    <EmptyIcon size={24} />
                    <span className="text-xs">{emptyLabel}</span>
                </div>
            </div>
        );
    }

    const showPrev = () => setIndex((i) => (i - 1 + images.length) % images.length);
    const showNext = () => setIndex((i) => (i + 1) % images.length);

    return (
        <>
            <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-light-dark bg-light group">
                <button
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="absolute inset-0 w-full h-full"
                    aria-label="Expand image"
                >
                    <img src={images[index]} alt={`Image ${index + 1} of ${images.length}`} className="h-full w-full object-cover" />
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
                                    onClick={() => setIndex(i)}
                                    aria-label={`Go to image ${i + 1}`}
                                    className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60')}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {lightboxIndex !== null && (
                <ImageLightbox
                    images={images}
                    startIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onIndexChange={setIndex}
                />
            )}
        </>
    );
}
