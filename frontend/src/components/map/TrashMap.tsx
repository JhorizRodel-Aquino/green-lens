// TrashMap.tsx
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { HeatmapLayer, type HeatPoint } from './HeatmapLayer';

// Fix for default Leaflet marker icons broken by Webpack/Vite bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import Logo from '../Logo';
import { SEVERITY_COLORS } from '@/config/severity';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Standard teardrop map pin: one continuous shape (a rounded square rotated
// 45deg so a single corner becomes the point), same shape used for both
// "my location" and report pins so they're all consistent.
const PIN_SIZE = 27;

const pinShapeHtml = (color: string) => `
  <div style="
    position: absolute;
    top: 0;
    left: 0;
    width: ${PIN_SIZE}px;
    height: ${PIN_SIZE}px;
    border-radius: 50% 50% 50% 0;
    background: ${color};
    border: 3px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    transform: rotate(-45deg);
    z-index: 1;
  "></div>
`;

// "My location" pin - pulsing rings ripple from the pin's tip (the actual
// location point, at the bottom-center of the icon)
const pulsePin = new L.DivIcon({
  className: 'custom-pulse-pin',
  html: `
    <div style="position: relative; width: ${PIN_SIZE}px; height: ${PIN_SIZE}px;">
      <div class="pulse-pin-ring" style="
        position: absolute;
        top: ${PIN_SIZE - 12}px;
        left: ${PIN_SIZE / 2 - 12}px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(22, 163, 74, 0.3);
        border: 3px solid rgba(22, 163, 74, 0.6);
      "></div>
      <div class="pulse-pin-ring-delayed" style="
        position: absolute;
        top: ${PIN_SIZE - 12}px;
        left: ${PIN_SIZE / 2 - 12}px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(22, 163, 74, 0.2);
        border: 3px solid rgba(22, 163, 74, 0.45);
      "></div>
      ${pinShapeHtml('#16a34a')}
    </div>
  `,
  iconSize: [PIN_SIZE, PIN_SIZE],
  iconAnchor: [PIN_SIZE / 2, PIN_SIZE],
});

// Colored pin icon for report markers, one per severity
const createSeverityIcon = (color: string) =>
  new L.DivIcon({
    className: 'severity-marker',
    html: `<div style="position: relative; width: ${PIN_SIZE}px; height: ${PIN_SIZE}px;">${pinShapeHtml(color)}</div>`,
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE],
  });

const severityIcons: Record<'HIGH' | 'LOW', L.DivIcon> = {
  HIGH: createSeverityIcon(SEVERITY_COLORS.HIGH),
  LOW: createSeverityIcon(SEVERITY_COLORS.LOW),
};

// Types for your Trash Reports
export type TrashReport = {
  id: string;
  lat: number;
  lng: number;
  severity: 'HIGH' | 'LOW';
  details: string;
};

export type MyLocation = { lat: number | null; lng: number | null; };

// Default fallback center used until the user's real location is known
const DEFAULT_CENTER: [number, number] = [14.4597, 120.9482];

// Recenters the map on the user's location the first time it becomes
// available (e.g. once GPS resolves after the map has already mounted at
// DEFAULT_CENTER). Only fires once so it doesn't fight the user panning
// the map around afterwards, and never recenters on report markers.
const RecenterOnMyLocation = ({ myLocation }: { myLocation?: MyLocation }) => {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (hasCentered.current) return;
    if (myLocation?.lat == null || myLocation?.lng == null) return;
    map.setView([myLocation.lat, myLocation.lng], map.getZoom());
    hasCentered.current = true;
  }, [map, myLocation]);

  return null;
};

type TrashMapProps = {
  reports: TrashReport[];
  setReports?: (trashReport: TrashReport[]) => void;
  myLocation?: MyLocation;
  showLogo?: boolean; // NEW: Control logo visibility
  onMarkerClick?: (report: TrashReport) => void; // NEW: Marker click handler
};

export const TrashMap = ({ 
  reports, 
  setReports, 
  myLocation, 
  showLogo = true, // Default: show logo
  onMarkerClick // Optional marker click handler
}: TrashMapProps) => {
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);

  // Convert report data into Heatmap points [lat, lng, intensity]
  const heatPoints: HeatPoint[] = reports.map((r) => [
    r.lat,
    r.lng,
    r.severity === 'HIGH' ? 1.0 : 0.3,
  ]);

  return (
    <div
      style={{ position: 'relative', width: '100vw', height: '100vh' }}
      className={showLogo ? 'zoom-below-logo' : undefined}
    >
      
      {/* Upper Left Logo: GreenLens - Conditional */}
      {showLogo && <Logo />}

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
        center={myLocation?.lat != null && myLocation?.lng != null ? [myLocation.lat, myLocation.lng] : DEFAULT_CENTER}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false} // Disable default zoom control
      >
        {/* Zoom control always top-left, pushed below the logo via CSS when it's showing */}
        <ZoomControl position="topleft" />

        {/* OpenStreetMap Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Recenter on the user's location once it's known */}
        <RecenterOnMyLocation myLocation={myLocation} />

        {/* Heatmap Component */}
        {showHeatmap && <HeatmapLayer points={heatPoints} />}

        {/* Pulse pin for user location */}
        {myLocation?.lat && myLocation?.lng && (
          <Marker 
            position={[myLocation.lat, myLocation.lng]}
            icon={pulsePin}
          >
            <Popup>
              <strong style={{ color: '#16a34a' }}>📍 You are here</strong>
            </Popup>
          </Marker>
        )}

        {/* Interactive Pointers / Markers - colored by severity */}
        {reports.map((report) => (
          <Marker
            key={report.id}
            position={[report.lat, report.lng]}
            icon={severityIcons[report.severity]}
            eventHandlers={{
              click: () => {
                if (onMarkerClick) {
                  onMarkerClick(report); // Call the custom handler with the report data
                }
              },
            }}
          >
            <Popup>
              <div>
                <strong style={{ color: SEVERITY_COLORS[report.severity] }}>
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