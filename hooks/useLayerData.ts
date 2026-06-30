import { useRef } from 'react';
import type { ClientConfig } from '@/lib/types/domain';

export type FeatureCollectionData = {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }>;
};

// Ports loadedLayerData/layerLoadPromises from shared/app.js: lazy-fetch a
// layer's GeoJSON from the public Storage bucket on first activation, then
// serve from an in-memory cache for every subsequent toggle.
export function useLayerData(config: ClientConfig) {
  const cacheRef = useRef<Map<string, FeatureCollectionData>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<FeatureCollectionData>>>(new Map());

  async function loadLayer(layerKey: string): Promise<FeatureCollectionData> {
    const cached = cacheRef.current.get(layerKey);
    if (cached) return cached;

    const inFlight = inFlightRef.current.get(layerKey);
    if (inFlight) return inFlight;

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-data/${config.slug}/${layerKey}.geojson`;

    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<FeatureCollectionData>;
      })
      .then((data) => {
        cacheRef.current.set(layerKey, data);
        return data;
      })
      .finally(() => {
        inFlightRef.current.delete(layerKey);
      });

    inFlightRef.current.set(layerKey, promise);
    return promise;
  }

  return { loadLayer };
}
