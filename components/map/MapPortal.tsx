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
import { useMutView } from '@/hooks/useMutView';
import { useMeasurementTool } from '@/hooks/useMeasurementTool';
import { useToasts } from '@/hooks/useToasts';
import { LayerPanel } from './LayerPanel';
import { MutControl } from './MutControl';
import { FarmFilterBar } from './FarmFilterBar';
import { ToolsPanel } from './ToolsPanel';
import { InfoPanel } from './InfoPanel';
import { Toast } from './Toast';

export function MapPortal({ config }: { config: ClientConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const map = useMap(containerRef, config.mapCenter, config.mapZoom);
  useSatelliteLayers(map);
  const { loadLayer } = useLayerData(config);
  const featureInfo = useFeatureInfo(map);

  const onFeatureClick = useCallback(
    (feature: GeoJSON.Feature, layerName: string) => featureInfo.select(feature, layerName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featureInfo.select]
  );

  const { toasts, push: pushToast } = useToasts();
  const onLayerLoadError = useCallback(
    (layerLabel: string) => pushToast(`Falha ao carregar a camada "${layerLabel}". Tente novamente.`),
    [pushToast]
  );

  const {
    status,
    visible,
    activeLayers,
    toggleLayer,
    loadDefaultLayers,
    zoomToLayer,
    applyStudyAreaExtent,
    zoomToStudyArea,
  } = useLayerVisibility(map, config, loadLayer, onFeatureClick, onLayerLoadError);

  const mutView = useMutView({ map, mut: config.mut, loadLayer, onSelecionarFeicao: onFeatureClick });

  const farmFilter = useFarmFilter(map, activeLayers, config.farmCodeFields);
  const measurement = useMeasurementTool(map);

  // Load default-active layers once the map exists, then lock navigation to
  // the study-area extent (AID bbox + configurable buffer) and frame it. If
  // the study-area layer isn't available, fall back to a plain zoom-to-layer
  // without locking bounds.
  const defaultKeys = config.layerGroups.flatMap((g) =>
    g.layers.filter((l) => l.defaultActive).map((l) => l.id)
  );
  const loadedDefaultsRef = useRef(false);
  useEffect(() => {
    if (!map || loadedDefaultsRef.current) return;
    loadedDefaultsRef.current = true;
    loadDefaultLayers(defaultKeys).then(() => {
      if (!applyStudyAreaExtent(config.zoomToLayerOnLoad, config.maxBoundsBufferKm)) {
        zoomToLayer(config.zoomToLayerOnLoad);
      }
    });
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
        mutView.limparSelecao();
      }
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [map, measurement, featureInfo, mutView]);

  const handleToggleLayer = (layerKey: string) => toggleLayer(layerKey, farmFilter.reapplyToLayer);

  // A visão MUT desenha a camada por conta própria: ao ligá-la, a mesma camada
  // sai do painel comum para não ficar desenhada duas vezes.
  const handleAlternarMut = () => {
    if (!mutView.ativo && config.mut && visible[config.mut.layerKey]) {
      toggleLayer(config.mut.layerKey, farmFilter.reapplyToLayer);
    }
    // Ao desligar, o painel de informações não pode continuar mostrando o
    // talhão que acabou de sair do mapa.
    if (mutView.ativo && featureInfo.selected?.layerName === config.mut?.layerKey) {
      featureInfo.close();
    }
    mutView.alternar();
  };

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
        {config.mut && (
          <MutControl
            mut={config.mut}
            ativo={mutView.ativo}
            carregando={mutView.carregando}
            erro={mutView.erro}
            modo={mutView.modo}
            onAlternar={handleAlternarMut}
            onModo={mutView.setModo}
          />
        )}
        <LayerPanel
          config={config}
          status={status}
          visible={visible}
          onToggle={handleToggleLayer}
          travada={mutView.ativo ? config.mut?.layerKey : null}
        />
      </div>

      <ToolsPanel
        mode={measurement.mode}
        onToggleMeasure={measurement.toggle}
        onClearMeasure={measurement.clear}
        onFitBounds={() => {
          if (!zoomToStudyArea()) zoomToLayer(config.zoomToLayerOnLoad);
        }}
      />

      <InfoPanel
        selected={featureInfo.selected}
        onClose={() => {
          featureInfo.close();
          mutView.limparSelecao();
        }}
        clientId={config.clientId}
        farmCodeFields={config.farmCodeFields}
        mut={config.mut}
        resumoMut={mutView.resumo}
      />

      <Toast toasts={toasts} />
    </div>
  );
}
