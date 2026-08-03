// utils/location.ts

export interface LocationResult {
  lat: number;
  lng: number;
  accuracy?: number;
  source: 'GPS';
}

/**
 * Fallback when the strict high-accuracy fix times out — accepts a cached (up to 5min old) or
 * network/Wi-Fi-based position instead of demanding a fresh GPS lock, same as how Map View's
 * continuous watchPosition() resolves even where a one-shot high-accuracy request won't.
 */
export function getRelaxedLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (err) => reject(err instanceof Error ? err : new Error('Could not get your location')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

/**
 * Get user location using GPS only
 * Throws error if GPS is unavailable or user denies permission
 */
export async function getUserLocation(): Promise<LocationResult> {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser');
  }

  try {
    const position = await getGPSLocation();
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      source: 'GPS',
    };
  } catch (error) {
    // Re-throw with a clear message
    if (error instanceof Error) {
      throw new Error(`GPS location failed: ${error.message}`);
    }
    throw new Error('GPS location failed');
  }
}

/**
 * Get location using GPS
 */
function getGPSLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(position);
      },
      (error) => {
        let message = 'GPS location failed';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please allow access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'GPS signal unavailable. Please enable GPS or move to an open area.';
            break;
          case error.TIMEOUT:
            message = 'GPS location timed out. Please try again.';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Watch location for continuous updates
 * Returns a function to stop watching
 */
export function watchLocation(
  onUpdate: (location: LocationResult) => void,
  onError?: (error: Error) => void
): () => void {
  if (!navigator.geolocation) {
    onError?.(new Error('Geolocation not supported'));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: 'GPS',
      });
    },
    (error) => {
      onError?.(new Error(error.message));
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );

  // Return cleanup function
  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}