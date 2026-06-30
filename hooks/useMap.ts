import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

// Ports initMap()'s map-creation portion from shared/app.js. Owns the
// Leaflet map instance lifecycle (create on mount, remove on unmount -
// important under React StrictMode's double-invoke, which the old vanilla
// app never had to handle).
export function useMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  center: [number, number],
  zoom: number
) {
  const mapRef = useRef<L.Map | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const instance = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      // Canvas rendering avoids per-feature DOM nodes, critical for
      // toggling layers with thousands of features without lag.
      preferCanvas: true,
    }).setView(center, zoom);

    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(instance);

    mapRef.current = instance;
    setMap(instance);

    return () => {
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  return map;
}
