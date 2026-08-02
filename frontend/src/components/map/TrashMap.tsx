// TrashMap.tsx
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Flame } from 'lucide-react';
import { HeatmapLayer, type HeatPoint } from './HeatmapLayer';

// Fix for default Leaflet marker icons broken by Webpack/Vite bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import Logo from '../Logo';
import { SEVERITY_COLORS } from '@/config/severity';
import { cn } from '@/utils/cn';

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

// Selected-marker variant: larger pin + a ring around its base, so whichever
// report is open in the detail panel is unambiguous at a glance on the map.
const SELECTED_PIN_SIZE = 36;

const createSelectedSeverityIcon = (color: string) =>
  new L.DivIcon({
    className: 'severity-marker-selected',
    html: `
      <div style="position: relative; width: ${SELECTED_PIN_SIZE}px; height: ${SELECTED_PIN_SIZE}px;">
        <div style="
          position: absolute;
          top: ${SELECTED_PIN_SIZE - 14}px;
          left: ${SELECTED_PIN_SIZE / 2 - 14}px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${color}33;
          border: 2px solid ${color};
        "></div>
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: ${SELECTED_PIN_SIZE}px;
          height: ${SELECTED_PIN_SIZE}px;
          border-radius: 50% 50% 50% 0;
          background: ${color};
          border: 3px solid white;
          box-shadow: 0 3px 10px rgba(0,0,0,0.5);
          transform: rotate(-45deg);
          z-index: 1;
        "></div>
      </div>
    `,
    iconSize: [SELECTED_PIN_SIZE, SELECTED_PIN_SIZE],
    iconAnchor: [SELECTED_PIN_SIZE / 2, SELECTED_PIN_SIZE],
  });

const selectedSeverityIcons: Record<'HIGH' | 'LOW', L.DivIcon> = {
  HIGH: createSelectedSeverityIcon(SEVERITY_COLORS.HIGH),
  LOW: createSelectedSeverityIcon(SEVERITY_COLORS.LOW),
};

// Types for your Trash Reports
export type ReportStatus = 'pending' | 'unresolved' | 'flagged' | 'resolved';

// Same values the backend's ReportStatusCode table uses for flagged statuses
// (backend/prisma/schema.prisma) — used as-is, no separate frontend vocabulary to keep in sync.
export type FlagReasonCode = 'FALSE_REPORT' | 'DUPLICATE_REPORT' | 'MINOR_LITTER' | 'ALREADY_RESOLVED' | 'PRIVATE_PROPERTY';

export const FLAG_REASON_LABELS: Record<FlagReasonCode, string> = {
  FALSE_REPORT: 'False report',
  DUPLICATE_REPORT: 'Duplicate report',
  MINOR_LITTER: 'Minor litter',
  ALREADY_RESOLVED: 'Already resolved',
  PRIVATE_PROPERTY: 'Private property',
};

export type TrashReport = {
  id: string;
  lat: number;
  lng: number;
  severity: 'HIGH' | 'LOW';
  details: string;
  locationLabel?: string;
  municipalityName?: string | null;
  provinceName?: string | null;
  regionName?: string | null;
  municipalityCode?: string | null;
  provinceCode?: string | null;
  regionCode?: string | null;
  imageUrls?: string[];
  status: ReportStatus;
  createdAt: string; // ISO timestamp
  resolvedAt?: string; // ISO timestamp, set when status becomes 'resolved'
  flagReason?: FlagReasonCode;
  flaggedAt?: string; // ISO timestamp, set when status becomes 'flagged'
  lguActionLogged?: boolean;
  resolutionProofUrls?: string[]; // "After" photos captured/uploaded when resolving
  remarks?: { text: string; createdAt: string; kind?: 'RESOLUTION' | 'REOPEN' | 'CITIZEN_REMARK' }[];
  wasReopened?: boolean; // true if this report has ever been reopened by the citizen who filed it
  jurisdictionStatus?: 'ASSIGNED' | 'UNASSIGNED';
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

// Default view should show every pin/heatmap point, not just wherever the map happens to
// center. Fits the viewport to all reports once, the first time they're available — doesn't
// fight the user panning/zooming afterwards, and doesn't re-fit as reports change live.
const FitAllReports = ({ reports }: { reports: TrashReport[] }) => {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hasFit.current || reports.length === 0) return;
    const bounds = L.latLngBounds(reports.map((r): [number, number] => [r.lat, r.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    hasFit.current = true;
  }, [map, reports]);

  return null;
};

type TrashMapProps = {
  reports: TrashReport[];
  setReports?: (trashReport: TrashReport[]) => void;
  myLocation?: MyLocation;
  showLogo?: boolean; // NEW: Control logo visibility
  onMarkerClick?: (report: TrashReport) => void; // NEW: Marker click handler
  isDetailPanelOpen?: boolean; // Shifts the Pins/Heatmap switch clear of a caller-rendered detail panel
  selectedReportId?: string; // Highlights this report's marker as the active selection
};

export const TrashMap = ({
  reports,
  setReports,
  myLocation,
  showLogo = true, // Default: show logo
  onMarkerClick, // Optional marker click handler
  isDetailPanelOpen = false,
  selectedReportId,
}: TrashMapProps) => {
  const [showPins, setShowPins] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);

  // Convert report data into Heatmap points [lat, lng, intensity]
  const heatPoints: HeatPoint[] = reports.map((r) => [
    r.lat,
    r.lng,
    r.severity === 'HIGH' ? 1.0 : 0.3,
  ]);

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      className={showLogo ? 'zoom-below-logo' : undefined}
    >

      {/* Upper Left Logo: GreenLens - Conditional */}
      {showLogo && <Logo />}

      {/* Pins / Heatmap switch, shifts left on desktop when the detail panel is open */}
      <div
        className={cn(
          'absolute top-4 right-4 z-[1000] flex gap-1 rounded-lg border border-light-dark bg-white p-1 shadow-sm transition-all duration-200',
          isDetailPanelOpen && 'md:right-[calc(28rem+1rem)]'
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

        {/* Default to fitting every report; only fall back to the user's location when there's nothing to fit */}
        <FitAllReports reports={reports} />
        {reports.length === 0 && <RecenterOnMyLocation myLocation={myLocation} />}

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
        {showPins &&
          reports.map((report) => (
            <Marker
              key={report.id}
              position={[report.lat, report.lng]}
              icon={
                report.id === selectedReportId
                  ? selectedSeverityIcons[report.severity]
                  : severityIcons[report.severity]
              }
              zIndexOffset={report.id === selectedReportId ? 1000 : 0}
              eventHandlers={{
                click: () => onMarkerClick?.(report),
              }}
            >
              {/* Default popup when the caller isn't handling clicks itself (e.g. admin's offcanvas) */}
              {!onMarkerClick && (
                <Popup>
                  <div>
                    <strong style={{ color: SEVERITY_COLORS[report.severity] }}>
                      {report.severity} SEVERITY
                    </strong>
                    <p style={{ margin: '4px 0 0' }}>{report.details}</p>
                  </div>
                </Popup>
              )}
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
};