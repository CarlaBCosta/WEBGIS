import { useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import type { ClientConfig } from '@/lib/types/domain';
import type { LayerStyle } from '@/lib/types/database';
import type { FeatureCollectionData } from './useLayerData';

export type LayerStatus = 'idle' | 'loading' | 'active' | 'error';

function buildLayer(
  data: FeatureCollectionData,
  style: LayerStyle,
  onFeatureClick: (feature: GeoJSON.Feature, layerName: string) => void,
  layerName: string
): L.GeoJSON {
  return L.geoJSON(data as GeoJSON.FeatureCollection, {
    style: () => ({
      color: style.color,
      fillColor: style.fillColor || style.color,
      fillOpacity: style.fillOpacity !== undefined ? style.fillOpacity : 0.2,
      weight: style.weight || 2,
      dashArray: style.dashArray || undefined,
    }),
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, {
        radius: style.radius || 6,
        fillColor: style.fillColor || '#3388ff',
        color: style.color || '#fff',
        weight: style.weight || 1,
        opacity: 1,
        fillOpacity: style.fillOpacity || 0.8,
      }),
    onEachFeature: (feature, layer) => {
      // Remember the original fillOpacity so the farm filter can restore it
      (layer as L.Path & { _baseFillOpacity?: number })._baseFillOpacity = (
        layer as L.Path
      ).options.fillOpacity;
      layer.on({
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          onFeatureClick(feature, layerName);
        },
      });
    },
  });
}

// Ports loadLayerData()/buildLayer()/toggleLayer()/initDefaultLayers() from
// shared/app.js. `loadLayer` comes from useLayerData (the fetch+cache part);
// this hook owns the built Leaflet layers, their on-map state, and status.
export function useLayerVisibility(
  map: L.Map | null,
  config: ClientConfig,
  loadLayer: (layerKey: string) => Promise<FeatureCollectionData>,
  onFeatureClick: (feature: GeoJSON.Feature, layerName: string) => void
) {
  const activeLayersRef = useRef<Map<string, L.GeoJSON>>(new Map());
  const [status, setStatus] = useState<Record<string, LayerStatus>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  const styleFor = useCallback(
    (layerKey: string): LayerStyle => {
      for (const group of config.layerGroups) {
        const layer = group.layers.find((l) => l.id === layerKey);
        if (layer) return layer.style || { color: '#3388ff', weight: 2 };
      }
      return { color: '#3388ff', weight: 2 };
    },
    [config]
  );

  const toggleLayer = useCallback(
    async (layerKey: string, onMatchFilter?: (layerKey: string) => void) => {
      if (!map) return;
      const existing = activeLayersRef.current.get(layerKey);

      if (existing) {
        if (map.hasLayer(existing)) {
          map.removeLayer(existing);
          setVisible((v) => ({ ...v, [layerKey]: false }));
        } else {
          existing.addTo(map);
          setVisible((v) => ({ ...v, [layerKey]: true }));
          onMatchFilter?.(layerKey);
        }
        return;
      }

      setStatus((s) => ({ ...s, [layerKey]: 'loading' }));
      try {
        const data = await loadLayer(layerKey);
        if (!data || !data.features || data.features.length === 0) {
          setStatus((s) => ({ ...s, [layerKey]: 'error' }));
          return;
        }
        const layer = buildLayer(data, styleFor(layerKey), onFeatureClick, layerKey);
        activeLayersRef.current.set(layerKey, layer);
        layer.addTo(map);
        setStatus((s) => ({ ...s, [layerKey]: 'active' }));
        setVisible((v) => ({ ...v, [layerKey]: true }));
        onMatchFilter?.(layerKey);
      } catch {
        setStatus((s) => ({ ...s, [layerKey]: 'error' }));
      }
    },
    [map, loadLayer, styleFor, onFeatureClick]
  );

  const loadDefaultLayers = useCallback(
    async (defaultKeys: string[]) => {
      if (!map) return;
      await Promise.all(
        defaultKeys.map(async (layerKey) => {
          setStatus((s) => ({ ...s, [layerKey]: 'loading' }));
          try {
            const data = await loadLayer(layerKey);
            if (!data || !data.features || data.features.length === 0) {
              setStatus((s) => ({ ...s, [layerKey]: 'error' }));
              return;
            }
            const layer = buildLayer(data, styleFor(layerKey), onFeatureClick, layerKey);
            activeLayersRef.current.set(layerKey, layer);
            layer.addTo(map);
            setStatus((s) => ({ ...s, [layerKey]: 'active' }));
            setVisible((v) => ({ ...v, [layerKey]: true }));
          } catch {
            setStatus((s) => ({ ...s, [layerKey]: 'error' }));
          }
        })
      );
    },
    [map, loadLayer, styleFor, onFeatureClick]
  );

  const zoomToLayer = useCallback(
    (layerKey: string | null) => {
      if (!map || !layerKey) return;
      const layer = activeLayersRef.current.get(layerKey);
      if (layer) map.fitBounds(layer.getBounds(), { padding: [40, 40] });
    },
    [map]
  );

  return {
    activeLayers: activeLayersRef.current,
    status,
    visible,
    toggleLayer,
    loadDefaultLayers,
    zoomToLayer,
  };
}
