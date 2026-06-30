'use client';

import { useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type { ClientConfig } from '@/lib/types/domain';
import { useMap } from '@/hooks/useMap';
import { useSatelliteLayers } from '@/hooks/useSatelliteLayers';
import { useLayerData } from '@/hooks/useLayerData';
import { useLayerVisibility } from '@/hooks/useLayerVisibility';
import { useFarmFilter } from '@/hooks/useFarmFilter';
import { useFeatureInfo } from '@/hooks/useFeatureInfo';
import { useMeasurementTool } from '@/hooks/useMeasurementTool';
import { LayerPanel } from './LayerPanel';
import { FarmFilterBar } from './FarmFilterBar';
import { ToolsPanel } from './ToolsPanel';
import { InfoPanel } from './InfoPanel';
import { SatelliteTimeline } from './SatelliteTimeline';

export function MapPortal({ config }: { config: ClientConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const map = useMap(containerRef, config.mapCenter, config.mapZoom);
  const satellite = useSatelliteLayers(map);
  const { loadLayer } = useLayerData(config);
  const featureInfo = useFeatureInfo(map);

  const onFeatureClick = useCallback(
    (feature: GeoJSON.Feature, layerName: string) => featureInfo.select(feature, layerName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featureInfo.select]
  );

  const { status, visible, activeLayers, toggleLayer, loadDefaultLayers, zoomToLayer } = useLayerVisibility(
    map,
    config,
    loadLayer,
    onFeatureClick
  );

  const farmFilter = useFarmFilter(map, activeLayers, config.farmCodeFields);
  const measurement = useMeasurementTool(map);

  // Load default-active layers once the map exists, then zoom to study area
  const defaultKeys = config.layerGroups.flatMap((g) =>
    g.layers.filter((l) => l.defaultActive).map((l) => l.id)
  );
  const loadedDefaultsRef = useRef(false);
  useEffect(() => {
    if (!map || loadedDefaultsRef.current) return;
    loadedDefaultsRef.current = true;
    loadDefaultLayers(defaultKeys).then(() => zoomToLayer(config.zoomToLayerOnLoad));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Single map click handler: measurement tool takes priority, otherwise
  // clicking blank map closes the feature info panel.
  useEffect(() => {
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => {
      if (measurement.mode) {
        measurement.handleMapClick(e);
      } else {
        featureInfo.close();
      }
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [map, measurement, featureInfo]);

  const handleToggleLayer = (layerKey: string) => toggleLayer(layerKey, farmFilter.reapplyToLayer);

  return (
    <div className="map-wrapper">
      <div id="map" ref={containerRef} />

      <div className="floating-panel">
        <div className="panel-header">
          <h2>Camadas do Projeto</h2>
        </div>
        <FarmFilterBar
          value={farmFilter.value}
          onChange={farmFilter.setValue}
          onApply={farmFilter.apply}
          onClear={farmFilter.clear}
          statusMessage={farmFilter.statusMessage}
        />
        <LayerPanel config={config} status={status} visible={visible} onToggle={handleToggleLayer} />
      </div>

      <ToolsPanel
        mode={measurement.mode}
        onToggleMeasure={measurement.toggle}
        onClearMeasure={measurement.clear}
        onFitBounds={() => zoomToLayer(config.zoomToLayerOnLoad)}
      />

      <InfoPanel selected={featureInfo.selected} onClose={featureInfo.close} />

      <SatelliteTimeline
        options={satellite.options}
        activeYear={satellite.activeYear}
        onChange={satellite.setYear}
      />
    </div>
  );
}
