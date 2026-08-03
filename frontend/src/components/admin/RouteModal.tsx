// frontend/src/components/admin/RouteModal.tsx
import { useEffect, useState } from 'react';
import { X, ExternalLink, LoaderCircle } from 'lucide-react';
import { getUserLocation } from '@/utils/location';
import { orderByNearestNeighbor, type LatLng } from '@/utils/geo';
import type { TrashReport } from '@/components/map/TrashMap';

type RouteModalProps = {
    reports: TrashReport[];
    onClose: () => void;
};

// Same relaxed fallback as DirectionsModal — accepts a cached/network-based
// position instead of demanding a fresh high-accuracy GPS lock.
function getRelaxedLocation(): Promise<LatLng> {
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

function coordsParam(p: LatLng): string {
    return `${p.lat},${p.lng}`;
}

export default function RouteModal({ reports, onClose }: RouteModalProps) {
    const [origin, setOrigin] = useState<LatLng | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const loc = await getUserLocation().catch(() => getRelaxedLocation());
                if (!cancelled) setOrigin({ lat: loc.lat, lng: loc.lng });
            } catch (err) {
                if (!cancelled) {
                    setLocationError(err instanceof Error ? err.message : 'Could not get your location');
                    // No sane "destination only" fallback for a multi-stop route —
                    // route from the first selected report instead of true geolocation.
                    setOrigin({ lat: reports[0].lat, lng: reports[0].lng });
                }
            }
        })();
        return () => { cancelled = true; };
    }, [reports]);

    const stops = origin ? orderByNearestNeighbor(origin, reports) : [];
    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1);

    const externalUrl = origin && destination
        ? `https://www.google.com/maps/dir/?api=1&origin=${coordsParam(origin)}&destination=${coordsParam(destination)}` +
          (waypoints.length > 0 ? `&waypoints=${waypoints.map(coordsParam).join('|')}` : '')
        : undefined;

    const embedSrc = origin && destination
        ? `https://maps.google.com/maps?saddr=${coordsParam(origin)}&daddr=${stops.map(coordsParam).join('+to+')}&output=embed`
        : undefined;

    return (
        <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 h-14 border-b border-light-dark">
                    <h3 className="text-sm font-bold text-dark">Route for {reports.length} reports</h3>
                    <div className="flex items-center gap-3">
                        {externalUrl && (
                            <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                                Open in Google Maps
                                <ExternalLink size={12} />
                            </a>
                        )}
                        <button type="button" onClick={onClose} aria-label="Close" className="text-dark-light hover:text-dark">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {locationError && (
                    <p className="px-4 py-2 text-xs text-secondary-dark bg-secondary-light/20 border-b border-light-dark">
                        {locationError} — routing from the first selected report instead.
                    </p>
                )}

                {!embedSrc ? (
                    <div className="w-full h-[70vh] flex items-center justify-center text-dark-light gap-2 text-sm">
                        <LoaderCircle size={18} className="animate-spin" />
                        Getting your location...
                    </div>
                ) : (
                    <iframe title="Route" className="w-full h-[70vh] border-0" src={embedSrc} />
                )}
            </div>
        </div>
    );
}
