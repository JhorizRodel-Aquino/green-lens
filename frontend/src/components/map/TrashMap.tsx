// TrashMap.tsx
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { HeatmapLayer, type HeatPoint } from './HeatmapLayer';

// Fix for default Leaflet marker icons broken by Webpack/Vite bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import Logo from '../Logo';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Types for your Trash Reports
export type TrashReport = {
  id: string;
  lat: number;
  lng: number;
  severity: 'HIGH' | 'LOW';
  details: string;
};

type TrashMapProps = {
  reports: TrashReport[];
  setReports?: (trashReport: TrashReport[]) => void;
};

export const TrashMap = ({ reports, setReports }: TrashMapProps) => {
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);

  // Convert report data into Heatmap points [lat, lng, intensity]
  const heatPoints: HeatPoint[] = reports.map((r) => [
    r.lat,
    r.lng,
    r.severity === 'HIGH' ? 1.0 : 0.3, // HIGH = 1.0 intensity (Red), LOW = 0.3 (Blue)
  ]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      
      {/* Upper Left Logo: GreenLens */}
      <Logo/>

      {/* UI Control Panel Overlay (Top Right) */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 1000,
          background: 'white',
          padding: '10px 14px',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <label style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(e) => setShowHeatmap(e.target.checked)}
            style={{ marginRight: '6px' }}
          />
          Heatmap
        </label>
      </div>

      {/* Main React Leaflet Container */}
      <MapContainer
        center={[14.4597, 120.9482]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        
      >
        {/* OpenStreetMap Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Heatmap Component */}
        {showHeatmap && <HeatmapLayer points={heatPoints} />}

        {/* Interactive Pointers / Markers */}
        {reports.map((report) => (
          <Marker key={report.id} position={[report.lat, report.lng]}>
            <Popup>
              <div>
                <strong style={{ color: report.severity === 'HIGH' ? 'red' : 'green' }}>
                  {report.severity} SEVERITY
                </strong>
                <p style={{ margin: '4px 0 0' }}>{report.details}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};