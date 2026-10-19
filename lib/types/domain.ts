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

// Visão MUT: configuração já resolvida (campos + catálogo de classes) que o
// portal usa para colorir, mostrar no hover e resumir a fazenda.
export interface MutClasse {
  nome: string;
  cor: string;
  // Coluna do Atlas que guarda a área desta classe na fazenda (ex.: CANA08).
  campoAtlas: string | null;
}

// Camada das fazendas (Atlas): um polígono por fazenda, com a elegibilidade e
// os dados do cabeçalho da prancha.
export interface MutFazendasConfig {
  layerKey: string;
  campoCodigo: string;
  campoNome: string | null;
  campoArea: string | null;
  campoPeriodo: string | null;
  campoLatLong: string | null;
  campoElegibilidade: string | null;
}

export interface MutConfig {
  layerKey: string;
  campoCodigo: string;
  campoTalhao: string | null;
  campoArea: string | null;
  campoElegibilidade: string;
  valoresElegivel: string[];
  campoUso: string | null;
  nomeFazenda: string;
  safra: string;
  anoInicial: number;
  anoMut: number;
  classes: MutClasse[];
  // null quando o cliente ainda não tem a camada das fazendas.
  fazendas: MutFazendasConfig | null;
}

export interface ClientConfig {
  slug: string;
  clientId: string;
  clientName: string;
  mapCenter: [number, number];
  mapZoom: number;
  zoomToLayerOnLoad: string | null;
  // Buffer (km) ao redor do bbox da área de estudo que define a extensão
  // máxima de navegação do mapa (maxBounds). Padrão 30 km.
  maxBoundsBufferKm: number;
  farmCodeFields: string[];
  primaryColor: string | null;
  logoUrl: string | null;
  layerGroups: LayerGroupConfig[];
  // null quando o cliente não tem visão MUT configurada ou ela está desligada.
  mut: MutConfig | null;
}
