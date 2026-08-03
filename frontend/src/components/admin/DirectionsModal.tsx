import { useEffect, useState } from 'react';
import { X, ExternalLink, LoaderCircle } from 'lucide-react';
import { getUserLocation, getRelaxedLocation } from '@/utils/location';

type DirectionsModalProps = {
    lat: number;
    lng: number;
    locationLabel?: string;
    onClose: () => void;
};

export default function DirectionsModal({ lat, lng, locationLabel, onClose }: DirectionsModalProps) {
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
                    <button type="button" onClick={onClose} aria-label="Close" className="text-dark-light hover:text-dark">
                        <X size={20} />
                    </button>
                </div>

                {locationError && (
                    <p className="px-4 py-2 text-xs text-secondary-dark bg-secondary-light/20 border-b border-light-dark">
                        {locationError} — showing the destination only.
                    </p>
                )}

                {!origin && !locationError ? (
                    <div className="w-full py-16 flex items-center justify-center text-dark-light gap-2 text-sm">
                        <LoaderCircle size={18} className="animate-spin" />
                        Getting your location...
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        <ol className="space-y-2">
                            <li className="flex items-center gap-2 text-sm text-dark-light">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-light text-[11px] font-semibold">•</span>
                                {locationError ? 'Location unavailable' : 'Your location'}
                            </li>
                            <li className="flex items-center gap-2 text-sm text-dark">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-light/20 text-primary-dark text-[11px] font-semibold">
                                    1
                                </span>
                                <span className="truncate">{locationLabel ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</span>
                            </li>
                        </ol>

                        <a
                            href={externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                        >
                            Open directions in Google Maps
                            <ExternalLink size={14} />
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
