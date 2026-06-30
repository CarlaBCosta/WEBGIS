import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

export interface SatelliteOption {
  year: string;
  label: string;
}

export const SATELLITE_OPTIONS: SatelliteOption[] = [
  { year: '2008', label: '2008 (Landsat)' },
  { year: '2014', label: '2014 (Wayback)' },
  { year: '2021', label: '2021 (Wayback)' },
  { year: '2026', label: '2026 (Atual)' },
];

function buildSatelliteLayers(): Record<string, L.Layer> {
  return {
    '2026': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: 'Google Satellite 2026',
    }),
    '2021': L.tileLayer(
      'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/26120/{z}/{y}/{x}',
      { maxZoom: 20, attribution: 'Esri Wayback (2021-12-21)' }
    ),
    '2014': L.tileLayer(
      'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/10/{z}/{y}/{x}',
      { maxZoom: 20, attribution: 'Esri Wayback (2014-02-20)' }
    ),
    '2008': L.layerGroup([
      L.tileLayer(
        'https://gibs-b.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2008-07-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
        { maxZoom: 9, attribution: 'NASA GIBS (MODIS 2008)' }
      ),
      L.tileLayer(
        'https://gibs-c.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_Global_Annual_TrueColor/default/2008-01-01/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg',
        { minZoom: 9, maxZoom: 13, attribution: 'NASA GIBS (Landsat 7 2008)' }
      ),
    ]),
  };
}

// Ports the satelliteLayers object + setSatelliteYear() from shared/app.js.
export function useSatelliteLayers(map: L.Map | null) {
  const layersRef = useRef<Record<string, L.Layer> | null>(null);
  const [activeYear, setActiveYear] = useState('2026');

  useEffect(() => {
    if (!map) return;
    const layers = buildSatelliteLayers();
    layersRef.current = layers;
    layers['2026'].addTo(map);

    return () => {
      Object.values(layers).forEach((layer) => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
      layersRef.current = null;
    };
  }, [map]);

  const setYear = (year: string) => {
    if (!map || !layersRef.current || year === activeYear) return;
    const layers = layersRef.current;
    map.removeLayer(layers[activeYear]);
    layers[year].addTo(map);
    setActiveYear(year);
  };

  return { activeYear, setYear, options: SATELLITE_OPTIONS };
}
