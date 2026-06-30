import { useRef, useState, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { length as turfLength, area as turfArea } from '@turf/turf';

export type MeasureMode = 'dist' | 'area' | null;

function pointsToLineString(points: L.LatLng[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: points.map((p) => [p.lng, p.lat]),
    },
  };
}

function pointsToPolygon(points: L.LatLng[]) {
  const coords = points.map((p) => [p.lng, p.lat]);
  coords.push(coords[0]);
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  };
}

function formatDistance(points: L.LatLng[]): string {
  if (points.length < 2) return '0 m';
  const km = turfLength(pointsToLineString(points), { units: 'kilometers' });
  const meters = km * 1000;
  return meters < 1000 ? `${meters.toFixed(1)} m` : `${km.toFixed(3)} km`;
}

function formatArea(points: L.LatLng[]): string {
  if (points.length < 3) return '0 m²';
  const sqMeters = turfArea(pointsToPolygon(points));
  if (sqMeters < 10000) return `${sqMeters.toFixed(1)} m²`;
  const ha = sqMeters / 10000;
  return `${ha.toFixed(2)} ha (${(sqMeters / 1000000).toFixed(3)} km²)`;
}

// Ports the custom measurement tool state machine from shared/app.js
// (toggleMeasure/handleMeasureClick/redrawMeasureLayer/etc), with
// calculateDistance()/calculateArea()'s hand-rolled math replaced by
// Turf.js (turf.length/turf.area) per the PRD's explicit Turf.js requirement.
export function useMeasurementTool(map: L.Map | null) {
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tooltipRef = useRef<L.Tooltip | null>(null);
  const previewRef = useRef<L.Polyline | L.Polygon | null>(null);
  const pointsRef = useRef<L.LatLng[]>([]);
  const [mode, setMode] = useState<MeasureMode>(null);

  useEffect(() => {
    if (!map) return;
    layerGroupRef.current = L.layerGroup().addTo(map);
    return () => {
      layerGroupRef.current?.clearLayers();
      layerGroupRef.current = null;
    };
  }, [map]);

  const showTooltip = useCallback((latlng: L.LatLng, text: string) => {
    if (!map) return;
    if (!tooltipRef.current) {
      tooltipRef.current = L.tooltip({
        permanent: true,
        className: 'measure-tooltip',
        offset: [15, 0],
        direction: 'right',
      });
    }
    tooltipRef.current.setLatLng(latlng).setContent(text).addTo(map);
  }, [map]);

  const clear = useCallback(() => {
    layerGroupRef.current?.clearLayers();
    pointsRef.current = [];
    previewRef.current = null;
    if (map && tooltipRef.current) {
      map.removeLayer(tooltipRef.current);
      tooltipRef.current = null;
    }
  }, [map]);

  const redrawStatic = useCallback((currentMode: MeasureMode) => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Polygon) group.removeLayer(layer);
    });
    const points = pointsRef.current;
    if (currentMode === 'dist') {
      L.polyline(points, { color: '#9ACD32', weight: 3, opacity: 0.9 }).addTo(group);
    } else if (currentMode === 'area' && points.length >= 3) {
      L.polygon(points, {
        color: '#9ACD32',
        fillColor: '#9ACD32',
        fillOpacity: 0.25,
        weight: 3,
        opacity: 0.9,
      }).addTo(group);
    }
  }, []);

  const updatePreview = useCallback((points: L.LatLng[], currentMode: MeasureMode) => {
    const group = layerGroupRef.current;
    if (!group) return;
    if (previewRef.current) group.removeLayer(previewRef.current);

    if (currentMode === 'dist') {
      previewRef.current = L.polyline(points, {
        color: '#9ACD32',
        weight: 2,
        dashArray: '5, 5',
        opacity: 0.8,
      }).addTo(group);
    } else if (currentMode === 'area') {
      previewRef.current = L.polygon(points, {
        color: '#9ACD32',
        fillColor: '#9ACD32',
        fillOpacity: 0.2,
        weight: 2,
        dashArray: '5, 5',
        opacity: 0.8,
      }).addTo(group);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: L.LeafletMouseEvent) => {
      const points = pointsRef.current;
      if (points.length === 0) return;
      const tempPoints = [...points, e.latlng];
      let text = '';
      if (mode === 'dist') {
        text = `Distância: ${formatDistance(tempPoints)}`;
      } else if (mode === 'area') {
        text = tempPoints.length >= 3 ? `Área: ${formatArea(tempPoints)}` : 'Clique mais pontos para fechar a área...';
      }
      showTooltip(e.latlng, text);
      updatePreview(tempPoints, mode);
    },
    [mode, showTooltip, updatePreview]
  );

  useEffect(() => {
    if (!map || !mode) return;
    map.on('mousemove', handleMouseMove);
    return () => {
      map.off('mousemove', handleMouseMove);
    };
  }, [map, mode, handleMouseMove]);

  const handleMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (!mode || !layerGroupRef.current) return;
      pointsRef.current = [...pointsRef.current, e.latlng];

      L.circleMarker(e.latlng, {
        radius: 5,
        color: '#222',
        fillColor: '#9ACD32',
        fillOpacity: 1,
        weight: 1.5,
      }).addTo(layerGroupRef.current);

      if (pointsRef.current.length > 1) redrawStatic(mode);
    },
    [mode, redrawStatic]
  );

  const toggle = useCallback(
    (newMode: 'dist' | 'area') => {
      if (!map) return;
      clear();
      if (mode === newMode) {
        setMode(null);
        map.getContainer().style.cursor = '';
      } else {
        setMode(newMode);
        map.getContainer().style.cursor = 'crosshair';
        showTooltip(map.getCenter(), 'Clique no mapa para iniciar a medição.');
      }
    },
    [map, mode, clear, showTooltip]
  );

  return { mode, toggle, clear, handleMapClick };
}
