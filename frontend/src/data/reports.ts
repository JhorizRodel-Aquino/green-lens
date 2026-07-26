import type { TrashReport } from '@/components/map/TrashMap';

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

export const INITIAL_REPORTS: TrashReport[] = [
    {
        id: '1', lat: 14.4550, lng: 120.9520, severity: 'HIGH', details: 'Illegal dump site behind store',
        locationLabel: 'Roxas Blvd, Pasay City', status: 'unresolved', createdAt: hoursAgo(3),
        imageUrls: [
            'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=400',
            'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=400',
        ],
    },
    {
        id: '2', lat: 14.4552, lng: 120.9523, severity: 'HIGH', details: 'Heavy pile of garbage bags blocking the sidewalk',
        locationLabel: 'F.B. Harrison St, Pasay City', status: 'resolved', createdAt: hoursAgo(30), resolvedAt: hoursAgo(2), lguActionLogged: true,
    },
    {
        id: '3', lat: 14.4650, lng: 120.9450, severity: 'LOW', details: 'Single plastic cup on curb',
        locationLabel: 'EDSA cor. Taft Ave, Pasay City', status: 'resolved', createdAt: hoursAgo(50), resolvedAt: hoursAgo(20), lguActionLogged: true,
    },
    {
        id: '4', lat: 14.4600, lng: 120.9480, severity: 'HIGH', details: 'Overflowing public bin near market entrance',
        locationLabel: 'Libertad St, Pasay City', status: 'flagged', createdAt: hoursAgo(10), flaggedAt: hoursAgo(9), flagReason: 'out_of_control',
    },
    {
        id: '5', lat: 14.4610, lng: 120.9490, severity: 'LOW', details: 'Scattered food wrappers near bus stop',
        locationLabel: 'Taft Ave, Pasay City', status: 'unresolved', createdAt: hoursAgo(1),
    },
    {
        id: '6', lat: 14.4580, lng: 120.9500, severity: 'HIGH', details: 'Construction debris dumped illegally',
        locationLabel: 'Buendia Ave, Pasay City', status: 'unresolved', createdAt: hoursAgo(150),
    },
];
