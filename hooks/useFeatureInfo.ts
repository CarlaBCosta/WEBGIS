import { useRef, useState, useCallback } from 'react';
import L from 'leaflet';

export interface SelectedFeature {
  layerName: string;
  properties: Record<string, unknown>;
}

// Ports showFeatureInfo()/closeInfoPanel()/highlightLayer from shared/app.js.
export function useFeatureInfo(map: L.Map | null) {
  const highlightRef = useRef<L.Layer | null>(null);
  const [selected, setSelected] = useState<SelectedFeature | null>(null);

  const close = useCallback(() => {
    if (map && highlightRef.current) {
      map.removeLayer(highlightRef.current);
    }
    highlightRef.current = null;
    setSelected(null);
  }, [map]);

  const select = useCallback(
    (feature: GeoJSON.Feature, layerName: string) => {
      if (!map) return;
      if (highlightRef.current) map.removeLayer(highlightRef.current);

      const geom = feature.geometry;
      if (geom.type === 'Point' || geom.type === 'MultiPoint') {
        const coords = (geom.type === 'Point' ? geom.coordinates : geom.coordinates[0]) as [
          number,
          number
        ];
        highlightRef.current = L.circleMarker([coords[1], coords[0]], {
          radius: 9,
          color: '#fff',
          fillColor: '#9ACD32',
          fillOpacity: 0.5,
          weight: 3,
          pane: 'markerPane',
        }).addTo(map);
      } else {
        highlightRef.current = L.geoJSON(feature, {
          style: { color: '#fff', fillColor: '#9ACD32', fillOpacity: 0.35, weight: 3 },
        }).addTo(map);
      }

      setSelected({ layerName, properties: (feature.properties || {}) as Record<string, unknown> });
    },
    [map]
  );

  return { selected, select, close };
}
