import { useEffect, useState } from 'react';
import { X, ExternalLink, LoaderCircle } from 'lucide-react';
import { getUserLocation } from '@/utils/location';

type DirectionsModalProps = {
    lat: number;
    lng: number;
    onClose: () => void;
};

// Fallback when the strict high-accuracy fix times out — accepts a cached (up to 5min old) or
// network/Wi-Fi-based position instead of demanding a fresh GPS lock, same as how Map View's
// continuous watchPosition() resolves even where a one-shot high-accuracy request won't.
function getRelaxedLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (err) => reject(err instanceof Error ? err : new Error('Could not get your location')),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    });
}

export default function DirectionsModal({ lat, lng, onClose }: DirectionsModalProps) {
    const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    // The embed only draws a route polyline when saddr is a real coordinate — blank saddr
    // just drops a pin on the destination with no directions.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const loc = await getUserLocation().catch(() => getRelaxedLocation());
                if (!cancelled) setOrigin({ lat: loc.lat, lng: loc.lng });
            } catch (err) {
                if (!cancelled) setLocationError(err instanceof Error ? err.message : 'Could not get your location');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const externalUrl = origin
        ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${lat},${lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    return (
        <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 h-14 border-b border-light-dark">
                    <h3 className="text-sm font-bold text-dark">Directions to this report</h3>
                    <div className="flex items-center gap-3">
                        <a
                            href={externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                            Open in Google Maps
                            <ExternalLink size={12} />
                        </a>
                        <button type="button" onClick={onClose} aria-label="Close" className="text-dark-light hover:text-dark">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {locationError && (
                    <p className="px-4 py-2 text-xs text-secondary-dark bg-secondary-light/20 border-b border-light-dark">
                        {locationError} — showing the destination only.
                    </p>
                )}

                {!origin && !locationError ? (
                    <div className="w-full h-[70vh] flex items-center justify-center text-dark-light gap-2 text-sm">
                        <LoaderCircle size={18} className="animate-spin" />
                        Getting your location...
                    </div>
                ) : (
                    <iframe
                        title="Directions"
                        className="w-full h-[70vh] border-0"
                        src={
                            origin
                                ? `https://maps.google.com/maps?saddr=${origin.lat},${origin.lng}&daddr=${lat},${lng}&output=embed`
                                : `https://maps.google.com/maps?daddr=${lat},${lng}&output=embed`
                        }
                    />
                )}
            </div>
        </div>
    );
}
