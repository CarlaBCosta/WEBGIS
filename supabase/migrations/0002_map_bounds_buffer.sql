-- Extensão máxima de navegação do mapa (PRD "Comportamento da Extensão do
-- Mapa"): o viewport fica limitado ao bbox da camada de área de estudo
-- (zoom_to_layer, normalmente a AID) acrescido de um buffer em km.
-- Configurável por cliente; padrão 30 km. Rode no SQL Editor do Supabase
-- depois de 0001_admin_panel_fields.sql.

alter table clients add column if not exists map_bounds_buffer_km numeric not null default 30;
