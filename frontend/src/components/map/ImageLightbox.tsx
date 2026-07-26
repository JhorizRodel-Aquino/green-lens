import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

type ImageLightboxProps = {
    images: string[];
    startIndex: number;
    onClose: () => void;
    onIndexChange?: (index: number) => void;
};

export default function ImageLightbox({ images, startIndex, onClose, onIndexChange }: ImageLightboxProps) {
    const [index, setIndex] = useState(startIndex);

    const showPrev = () => setIndex((i) => {
        const next = (i - 1 + images.length) % images.length;
        onIndexChange?.(next);
        return next;
    });
    const showNext = () => setIndex((i) => {
        const next = (i + 1) % images.length;
        onIndexChange?.(next);
        return next;
    });

    return (
        <div className="fixed inset-0 z-[1003] flex items-center justify-center bg-black/80">
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute top-4 right-4 text-white/80 hover:text-white"
            >
                <X size={28} />
            </button>

            {images.length > 1 && (
                <button
                    type="button"
                    onClick={showPrev}
                    aria-label="Previous image"
                    className="absolute left-4 text-white/80 hover:text-white"
                >
                    <ChevronLeft size={32} />
                </button>
            )}

            <img
                src={images[index]}
                alt={`Report image ${index + 1} of ${images.length}`}
                className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
            />

            {images.length > 1 && (
                <button
                    type="button"
                    onClick={showNext}
                    aria-label="Next image"
                    className="absolute right-4 text-white/80 hover:text-white"
                >
                    <ChevronRight size={32} />
                </button>
            )}

            {images.length > 1 && (
                <span className="absolute bottom-6 text-sm text-white/70">
                    {index + 1} / {images.length}
                </span>
            )}
        </div>
    );
}
