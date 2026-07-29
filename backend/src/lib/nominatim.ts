export interface NominatimAddress {
    country_code?: string;
    country?: string;
    city?: string;
    town?: string;
    municipality?: string;
    county?: string;
    state_district?: string;
    state?: string;
    region?: string;
}

/** Returns a `wait()` that resolves only once `minIntervalMs` has passed since the last resolved call. */
export function createThrottle(minIntervalMs: number): () => Promise<void> {
    let nextAvailableAt = 0;
    return function wait(): Promise<void> {
        const now = Date.now();
        const delay = Math.max(0, nextAvailableAt - now);
        nextAvailableAt = Math.max(now, nextAvailableAt) + minIntervalMs;
        return new Promise((resolve) => setTimeout(resolve, delay));
    };
}

// Nominatim usage policy caps unauthenticated use at 1 request/second, globally.
const throttle = createThrottle(1000);

export async function reverseGeocode(lat: number, lng: number): Promise<NominatimAddress> {
    await throttle();
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'green-lens-backend/1.0' } });
    if (!res.ok) throw new Error(`Nominatim request failed: ${res.status}`);
    const data = (await res.json()) as { address?: NominatimAddress };
    return data.address ?? {};
}
