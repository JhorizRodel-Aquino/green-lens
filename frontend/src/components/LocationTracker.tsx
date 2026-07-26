import { useState, useEffect } from 'react';
import { watchLocation } from '@/utils/location';

export default function LocationTracker() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Start watching location
    const unwatch = watchLocation(
      (result) => {
        // This runs every time location updates
        setLocation({ lat: result.lat, lng: result.lng });
        console.log('📍 Updated:', result.lat, result.lng);
      },
      (err) => {
        setError(err.message);
      }
    );

    // Stop watching when component unmounts
    return () => unwatch();
  }, []);

  return (
    <div className="p-4">
      {error ? (
        <p className="text-red-500">❌ {error}</p>
      ) : location ? (
        <div>
          <p className="font-semibold">📍 Live Location:</p>
          <p>Latitude: {location.lat}</p>
          <p>Longitude: {location.lng}</p>
          <p className="text-xs text-gray-400">Updating every second</p>
        </div>
      ) : (
        <p>⏳ Getting location...</p>
      )}
    </div>
  );
}