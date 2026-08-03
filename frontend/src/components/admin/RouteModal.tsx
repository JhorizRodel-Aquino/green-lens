// frontend/src/components/admin/RouteModal.tsx
import { useEffect, useState } from 'react';
import { X, ExternalLink, LoaderCircle } from 'lucide-react';
import { getUserLocation, getRelaxedLocation } from '@/utils/location';
import { orderByNearestNeighbor, type LatLng } from '@/utils/geo';
import type { TrashReport } from '@/components/map/TrashMap';

type RouteModalProps = {
    reports: TrashReport[];
    onClose: () => void;
};

function coordsParam(p: LatLng): string {
    return `${Number(p.lat)},${Number(p.lng)}`;
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reports is a snapshot for
        // this modal's lifetime (it only mounts once per selection, see ReportsPage); re-running
        // on every new array identity would refire GPS acquisition on unrelated parent re-renders.
    }, []);

    const stops = origin ? orderByNearestNeighbor(origin, reports) : [];
    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1);

    const externalUrl = origin && destination
        ? `https://www.google.com/maps/dir/?api=1&origin=${coordsParam(origin)}&destination=${coordsParam(destination)}` +
          (waypoints.length > 0 ? `&waypoints=${waypoints.map(coordsParam).join('|')}` : '')
        : undefined;

    return (
        <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 h-14 border-b border-light-dark">
                    <h3 className="text-sm font-bold text-dark">Route for {reports.length} reports</h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="text-dark-light hover:text-dark">
                        <X size={20} />
                    </button>
                </div>

                {locationError && (
                    <p className="px-4 py-2 text-xs text-secondary-dark bg-secondary-light/20 border-b border-light-dark">
                        {locationError} — routing from the first selected report instead.
                    </p>
                )}

                {!origin ? (
                    <div className="w-full py-16 flex items-center justify-center text-dark-light gap-2 text-sm">
                        <LoaderCircle size={18} className="animate-spin" />
                        Getting your location...
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        <ol className="space-y-2">
                            <li className="flex items-center gap-2 text-sm text-dark-light">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-light text-[11px] font-semibold">•</span>
                                {locationError ? 'Starting from first selected report' : 'Your location'}
                            </li>
                            {stops.map((stop, i) => (
                                <li key={stop.id} className="flex items-center gap-2 text-sm text-dark">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-light/20 text-primary-dark text-[11px] font-semibold">
                                        {i + 1}
                                    </span>
                                    <span className="truncate">{stop.locationLabel ?? `${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`}</span>
                                </li>
                            ))}
                        </ol>

                        {externalUrl && (
                            <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                            >
                                Open route in Google Maps
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
