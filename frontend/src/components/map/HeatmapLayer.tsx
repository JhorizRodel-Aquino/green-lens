// HeatmapLayer.tsx
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

// Type for Heatmap Data Point: [lat, lng, intensity]
export type HeatPoint = [number, number, number];

interface HeatmapLayerProps {
  points: HeatPoint[];
  radius?: number;
  blur?: number;
  maxZoom?: number;
}

export const HeatmapLayer = ({
  points,
  radius = 25,
  blur = 15,
  maxZoom = 17,
}: HeatmapLayerProps) => {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    // Create the Leaflet Heat Layer
    const heatLayer = L.heatLayer(points, {
      radius,
      blur,
      maxZoom,
      gradient: {
        0.4: 'blue',
        0.65: 'lime',
        1.0: 'red',
      },
    }).addTo(map);

    // Cleanup layer when component unmounts or points update
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points, radius, blur, maxZoom]);

  return null; // This component manages Leaflet state directly, no DOM output
};