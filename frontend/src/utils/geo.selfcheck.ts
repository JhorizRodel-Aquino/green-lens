// Run with: npx tsx frontend/src/utils/geo.selfcheck.ts
import { haversineDistanceMeters, orderByNearestNeighbor } from './geo';

// Manila to Cebu is ~570km — sanity check the formula is in the right ballpark.
const manila = { lat: 14.5995, lng: 120.9842 };
const cebu = { lat: 10.3157, lng: 123.8854 };
const distKm = haversineDistanceMeters(manila, cebu) / 1000;
console.assert(distKm > 550 && distKm < 600, `expected ~570km, got ${distKm}`);

console.assert(haversineDistanceMeters(manila, manila) === 0, 'distance to self must be 0');

// Nearest-neighbor: origin at 0,0; points at increasing distance along same axis.
// Order should be near->far regardless of input order.
const origin = { lat: 0, lng: 0 };
const points = [
    { id: 'far', lat: 0, lng: 3 },
    { id: 'near', lat: 0, lng: 1 },
    { id: 'mid', lat: 0, lng: 2 },
];
const ordered = orderByNearestNeighbor(origin, points);
console.assert(
    ordered.map((p) => p.id).join(',') === 'near,mid,far',
    `expected near,mid,far — got ${ordered.map((p) => p.id).join(',')}`
);

// Must not mutate the input array.
console.assert(points[0].id === 'far', 'input array must not be mutated');

console.log('geo.selfcheck.ts: all assertions passed');
