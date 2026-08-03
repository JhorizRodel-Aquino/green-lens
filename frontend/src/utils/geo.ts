export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

// Greedy nearest-neighbor: not optimal TSP, but good enough for ≤10 stops and
// avoids pulling in a solver for a "roughly sensible order" requirement.
export function orderByNearestNeighbor<T extends LatLng>(origin: LatLng, points: T[]): T[] {
    const remaining = [...points];
    const ordered: T[] = [];
    let current = origin;

    while (remaining.length > 0) {
        let nearestIdx = 0;
        let nearestDist = haversineDistanceMeters(current, remaining[0]);
        for (let i = 1; i < remaining.length; i++) {
            const dist = haversineDistanceMeters(current, remaining[i]);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIdx = i;
            }
        }
        const [next] = remaining.splice(nearestIdx, 1);
        ordered.push(next);
        current = next;
    }

    return ordered;
}
