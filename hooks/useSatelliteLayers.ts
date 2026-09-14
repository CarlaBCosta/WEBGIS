import { useEffect } from 'react';
import L from 'leaflet';

// Mapa base de satélite atual (Google). A antiga barra de anos (2008/2014/2021)
// foi removida: a evolução histórica agora é mostrada pelos timelapses anuais
// de cada fazenda, gerados pelo robô (scripts/timelapse).
export function useSatelliteLayers(map: L.Map | null) {
  useEffect(() => {
    if (!map) return;
    const base = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: 'Google Satellite',
    });
    base.addTo(map);

    return () => {
      if (map.hasLayer(base)) map.removeLayer(base);
    };
  }, [map]);
}
