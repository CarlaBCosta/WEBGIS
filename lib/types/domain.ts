import type { LayerStyle } from './database';

// Shape consumed by the map portal - mirrors loadClientConfig()'s return
// value from the legacy shared/app.js, kept identical so the ported hooks
// don't need to change their data contract.

export interface LayerConfig {
  id: string; // layer_key
  label: string;
  legendStyle: string;
  style: LayerStyle;
  defaultActive: boolean;
}

export interface LayerGroupConfig {
  title: string;
  layers: LayerConfig[];
}

export interface ClientConfig {
  slug: string;
  clientId: string;
  clientName: string;
  mapCenter: [number, number];
  mapZoom: number;
  zoomToLayerOnLoad: string | null;
  farmCodeFields: string[];
  primaryColor: string | null;
  logoUrl: string | null;
  layerGroups: LayerGroupConfig[];
}
