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
  farm_code_fields: string[];
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LayerGroupRow {
  id: string;
  client_id: string;
  title: string;
  sort_order: number;
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
  updated_at: string;
}

export interface LayerGroupWithLayersRow extends LayerGroupRow {
  layers: LayerRow[];
}
