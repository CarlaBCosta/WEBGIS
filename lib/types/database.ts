// Mirrors supabase/schema.sql + supabase/migrations/0001_admin_panel_fields.sql

export interface LayerStyle {
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  weight?: number;
  dashArray?: string;
  radius?: number;
}

export interface ClientRow {
  id: string;
  slug: string;
  name: string;
  map_center_lat: number;
  map_center_lng: number;
  map_zoom: number;
  zoom_to_layer: string | null;
  map_bounds_buffer_km: number;
  farm_code_fields: string[];
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean;
  projetos: string[]; // tipos de projeto (migration 0008)
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayerGroupRow {
  id: string;
  client_id: string;
  title: string;
  sort_order: number;
  descricao: string;
  template_id: string | null; // divisão do modelo de onde veio (migration 0007)
}

export interface LayerRow {
  id: string;
  client_id: string;
  group_id: string;
  layer_key: string;
  label: string;
  legend_style: string;
  style: LayerStyle;
  default_active: boolean;
  sort_order: number;
  storage_path: string | null;
  geometry_type: string | null;
  feature_count: number | null;
  source: string | null;
  updated_at: string;
}

export interface LayerGroupWithLayersRow extends LayerGroupRow {
  layers: LayerRow[];
}

export interface TipoProjetoRow {
  id: string;
  nome: string;
  sort_order: number;
}

// Fila do robô de timelapse (migration 0005).
export type TimelapseJobStatus = 'pendente' | 'processando' | 'concluido' | 'erro' | 'cancelado';

export interface TimelapseJobRow {
  id: string;
  client_id: string;
  layer_key: string;
  campo: string;
  sensor: 'landsat' | 'sentinel2';
  status: TimelapseJobStatus;
  total: number | null;
  concluidas: number;
  falhas: number;
  mensagem: string | null;
  criado_por: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
}

export interface TimelapseRoboRow {
  id: number;
  ultimo_sinal: string | null;
  versao: string | null;
  maquina: string | null;
}

// Taxonomia padrão de grupos temáticos (migration 0003): usada pelo cadastro
// para classificar camadas automaticamente pelo nome do arquivo.
export interface LayerGroupTemplateRow {
  id: string;
  title: string;
  objective: string;
  descricao: string;
  sort_order: number;
  keywords: string[];
}
