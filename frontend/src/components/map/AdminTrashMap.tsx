import { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Flame } from 'lucide-react';
import { HeatmapLayer, type HeatPoint } from './HeatmapLayer';
import ReportDetailPanel from './ReportDetailPanel';
import { cn } from '@/utils/cn';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

export type TrashReport = {
    id: string;
    lat: number;
    lng: number;
    severity: 'HIGH' | 'LOW';
    details: string;
    locationLabel?: string;
    imageUrls?: string[];
};

type AdminTrashMapProps = {
    reports: TrashReport[];
};

export default function AdminTrashMap({ reports }: AdminTrashMapProps) {
    const [showPins, setShowPins] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [selectedReport, setSelectedReport] = useState<TrashReport | null>(null);

    const heatPoints: HeatPoint[] = reports.map((r) => [
        r.lat,
        r.lng,
        r.severity === 'HIGH' ? 1.0 : 0.3,
    ]);

    return (
        <div className="relative h-full w-full">
            <div
                className={cn(
                    'absolute top-4 right-4 z-[1000] flex gap-1 rounded-lg border border-light-dark bg-white p-1 shadow-sm transition-all duration-200',
                    selectedReport && 'md:right-[calc(24rem+1rem)]'
                )}
            >
                <button
                    type="button"
                    onClick={() => setShowPins((v) => (v && !showHeatmap ? v : !v))}
                    aria-pressed={showPins}
                    className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        showPins ? 'bg-primary text-white' : 'text-dark-light hover:bg-light'
                    )}
                >
                    <MapPin size={16} />
                    Pins
                </button>
                <button
                    type="button"
                    onClick={() => setShowHeatmap((v) => (v && !showPins ? v : !v))}
                    aria-pressed={showHeatmap}
                    className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        showHeatmap ? 'bg-primary text-white' : 'text-dark-light hover:bg-light'
                    )}
                >
                    <Flame size={16} />
                    Heatmap
                </button>
            </div>

            <MapContainer center={[14.4597, 120.9482]} zoom={13} style={{ width: '100%', height: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {showHeatmap && <HeatmapLayer points={heatPoints} />}

                {showPins &&
                    reports.map((report) => (
                        <Marker
                            key={report.id}
                            position={[report.lat, report.lng]}
                            eventHandlers={{ click: () => setSelectedReport(report) }}
                        />
                    ))}
            </MapContainer>

            {selectedReport && (
                <ReportDetailPanel report={selectedReport} onClose={() => setSelectedReport(null)} />
            )}
        </div>
    );
}
