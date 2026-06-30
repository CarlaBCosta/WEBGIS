import { useState, useCallback } from 'react';
import L from 'leaflet';

// Ports applyFarmFilter()/applyFilterToLayer()/featureMatchesFarmCode()/
// clearFarmFilter() from shared/app.js.
export function useFarmFilter(
  map: L.Map | null,
  activeLayers: Map<string, L.GeoJSON>,
  farmCodeFields: string[]
) {
  const [value, setValue] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentFilter, setCurrentFilter] = useState('');

  const matches = useCallback(
    (properties: Record<string, unknown> | undefined, code: string) => {
      if (!properties) return false;
      const needle = code.toLowerCase();
      return farmCodeFields.some((field) => {
        const v = properties[field];
        return v !== undefined && v !== null && String(v).toLowerCase().includes(needle);
      });
    },
    [farmCodeFields]
  );

  const applyToLayer = useCallback(
    (layerKey: string, filter: string) => {
      const layer = activeLayers.get(layerKey);
      let matchCount = 0;
      let bounds: L.LatLngBounds | null = null;
      if (!layer) return { matchCount, bounds };

      layer.eachLayer((featureLayer) => {
        const fl = featureLayer as L.Path & {
          feature?: GeoJSON.Feature;
          _baseFillOpacity?: number;
          getBounds?: () => L.LatLngBounds;
          getLatLng?: () => L.LatLng;
        };
        const props = fl.feature?.properties ?? undefined;
        const isMatch = !filter || matches(props, filter);

        if ('setStyle' in fl && typeof fl.setStyle === 'function') {
          const baseFillOpacity = fl._baseFillOpacity !== undefined ? fl._baseFillOpacity : 0.2;
          fl.setStyle({
            opacity: isMatch ? 1 : 0.05,
            fillOpacity: isMatch ? baseFillOpacity : 0.03,
          });
        }

        if (isMatch && filter) {
          matchCount++;
          if (fl.getBounds) {
            const fb = fl.getBounds();
            bounds = bounds ? bounds.extend(fb) : L.latLngBounds(fb.getSouthWest(), fb.getNorthEast());
          } else if (fl.getLatLng) {
            const ll = fl.getLatLng();
            bounds = bounds ? bounds.extend(ll) : L.latLngBounds(ll, ll);
          }
        }
      });

      return { matchCount, bounds };
    },
    [activeLayers, matches]
  );

  const apply = useCallback(() => {
    const code = value.trim();
    if (!code) {
      clear();
      return;
    }
    setCurrentFilter(code);

    let matchCount = 0;
    const matchedBounds: L.LatLngBounds[] = [];
    activeLayers.forEach((_layer, layerKey) => {
      const result = applyToLayer(layerKey, code);
      matchCount += result.matchCount;
      if (result.bounds) matchedBounds.push(result.bounds);
    });

    if (matchCount === 0) {
      setStatusMessage(
        `Nenhuma feição encontrada para o código "${code}" nas camadas ativas. Ative outras camadas e tente novamente.`
      );
      return;
    }

    setStatusMessage(`${matchCount} feição(ões) encontrada(s) para o código "${code}".`);

    if (map && matchedBounds.length > 0) {
      const bounds = matchedBounds[0];
      for (let i = 1; i < matchedBounds.length; i++) bounds.extend(matchedBounds[i]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, activeLayers, applyToLayer, map]);

  // Re-applies the active filter to a layer that was just toggled on
  const reapplyToLayer = useCallback(
    (layerKey: string) => {
      if (currentFilter) applyToLayer(layerKey, currentFilter);
    },
    [currentFilter, applyToLayer]
  );

  const clear = useCallback(() => {
    setCurrentFilter('');
    setValue('');
    setStatusMessage('');
    activeLayers.forEach((layer) => {
      layer.eachLayer((featureLayer) => {
        const fl = featureLayer as L.Path & { _baseFillOpacity?: number };
        if ('setStyle' in fl && typeof fl.setStyle === 'function') {
          fl.setStyle({
            opacity: 1,
            fillOpacity: fl._baseFillOpacity !== undefined ? fl._baseFillOpacity : 0.2,
          });
        }
      });
    });
  }, [activeLayers]);

  return { value, setValue, statusMessage, apply, clear, reapplyToLayer, hasActiveFilter: !!currentFilter };
}
