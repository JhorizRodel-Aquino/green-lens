export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export const SEVERITY_COLORS: Record<Severity, string> = {
  HIGH: '#ef4444', // red
  MEDIUM: '#f97316', // orange
  LOW: '#f59e0b', // accent
};

// Tailwind classes for the severity pill, so the three places that render one
// don't each carry their own ternary.
export const SEVERITY_BADGE: Record<Severity, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-orange-100 text-orange-700',
  LOW: 'bg-secondary-light/30 text-secondary-dark',
};

// Heatmap intensity per severity.
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  HIGH: 1.0,
  MEDIUM: 0.6,
  LOW: 0.3,
};
