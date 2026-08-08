export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

// Map pin / marker colors (hex, used with Leaflet DivIcons)
export const SEVERITY_COLORS: Record<Severity, string> = {
  HIGH: '#ef4444', // red
  MEDIUM: '#f97316', // orange
  LOW: '#eab308', // yellow
} as const;

// Tailwind classes for severity badges/chips
export const SEVERITY_BADGE_CLASSES: Record<Severity, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-orange-100 text-orange-700',
  LOW: 'bg-yellow-100 text-yellow-700',
} as const;
