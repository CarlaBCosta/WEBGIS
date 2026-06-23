-- Popula o cliente "cliente-demo" com a mesma configuração que já tínhamos
-- em clientes/cliente-demo/config.js. Rode depois de schema.sql.
-- Os arquivos .geojson em si NÃO vêm daqui - suba-os com:
--   node scripts/upload-cliente.js cliente-demo
-- (lendo de clientes/cliente-demo/data/, que já existem no repositório).

with c as (
    insert into clients (slug, name, map_center_lat, map_center_lng, map_zoom, zoom_to_layer)
    values ('cliente-demo', 'Cliente Demo', -21.90, -48.67, 11, 'Area_de_Influencias_Direta')
    on conflict (slug) do update set name = excluded.name
    returning id
),
g1 as (
    insert into layer_groups (client_id, title, sort_order)
    select id, 'Empreendimento', 1 from c returning id, client_id
),
g2 as (
    insert into layer_groups (client_id, title, sort_order)
    select id, 'Ambiental & Conservação', 2 from c returning id, client_id
),
g3 as (
    insert into layer_groups (client_id, title, sort_order)
    select id, 'Recursos Hídricos', 3 from c returning id, client_id
),
g4 as (
    insert into layer_groups (client_id, title, sort_order)
    select id, 'Socioambiental & Cultural', 4 from c returning id, client_id
),
g5 as (
    insert into layer_groups (client_id, title, sort_order)
    select id, 'Solo & Outros', 5 from c returning id, client_id
)
insert into layers (client_id, group_id, layer_key, label, legend_style, style, default_active, sort_order)
select client_id, id, v.layer_key, v.label, v.legend_style, v.style::jsonb, v.default_active, v.sort_order
from g1, (values
    ('Usina_Principal_teste', 'Usina Principal', 'background-color: #E31A1C; border-color: #ffffff;', '{"color":"#E31A1C","fillColor":"#E31A1C","fillOpacity":0.8,"weight":3}', true, 1),
    ('Area_Diretamente_Afetada_teste', 'ADA (Área Direta Afetada)', 'background-color: rgba(227, 26, 28, 0.2); border: 2px dashed #E31A1C;', '{"color":"#E31A1C","fillColor":"#E31A1C","fillOpacity":0.15,"weight":2,"dashArray":"6, 6"}', true, 2),
    ('Area_de_Influencias_Direta_teste', 'AID (Área de Influência)', 'background-color: rgba(31, 120, 180, 0.1); border: 2px solid #1F78B4;', '{"color":"#1F78B4","fillColor":"#1F78B4","fillOpacity":0.08,"weight":3}', true, 3),
    ('Usinas_Vizinhas_teste', 'Usinas Vizinhas', 'background-color: #FF7F00; border-radius: 50%;', '{"radius":6,"fillColor":"#FF7F00","color":"#fff","weight":1,"fillOpacity":0.9}', true, 4)
) as v(layer_key, label, legend_style, style, default_active, sort_order)

union all
select client_id, id, v.layer_key, v.label, v.legend_style, v.style::jsonb, v.default_active, v.sort_order
from g2, (values
    ('Area_de_Preservacao_Permanente_teste', 'APP (Preservação Permanente)', 'background-color: rgba(51, 160, 44, 0.4); border-color: #33A02C;', '{"color":"#33A02C","fillColor":"#33A02C","fillOpacity":0.3,"weight":1.5}', false, 1),
    ('Reserva_Legal_teste', 'Reserva Legal', 'background-color: rgba(178, 223, 138, 0.4); border-color: #B2DF8A;', '{"color":"#B2DF8A","fillColor":"#B2DF8A","fillOpacity":0.35,"weight":1.5}', false, 2),
    ('Vegetacao_Nativa_teste', 'Vegetação Nativa', 'background-color: rgba(51, 160, 44, 0.7); border-color: #1E5618;', '{"color":"#1E5618","fillColor":"#2E8B57","fillOpacity":0.4,"weight":1.5}', false, 3),
    ('Turfeiras_teste', 'Turfeiras (Áreas Úmidas)', 'background-color: rgba(166, 97, 26, 0.5); border-color: #A6611A;', '{"color":"#A6611A","fillColor":"#A6611A","fillOpacity":0.4,"weight":1.5}', false, 4),
    ('UC_teste', 'Unidades de Conservação (UC)', 'background-color: rgba(227, 26, 28, 0.3); border: 1px dashed #E31A1C;', '{"color":"#E31A1C","fillColor":"#E31A1C","fillOpacity":0.1,"weight":1.5,"dashArray":"4, 4"}', false, 5),
    ('RAMSAR_teste', 'Sítios RAMSAR', 'background-color: rgba(1, 102, 94, 0.4); border-color: #01665E;', '{"color":"#01665E","fillColor":"#01665E","fillOpacity":0.3,"weight":1.5}', false, 6),
    ('Birdlife_teste', 'Áreas Importantes de Aves', 'background-color: rgba(253, 191, 111, 0.4); border-color: #FDBF6F;', '{"color":"#FDBF6F","fillColor":"#FDBF6F","fillOpacity":0.3,"weight":1.5}', false, 7)
) as v(layer_key, label, legend_style, style, default_active, sort_order)

union all
select client_id, id, v.layer_key, v.label, v.legend_style, v.style::jsonb, v.default_active, v.sort_order
from g3, (values
    ('Corpos_dagua_teste', E'Corpos d''água', 'background-color: #A6CEE3; border-color: #1F78B4;', '{"color":"#1F78B4","fillColor":"#A6CEE3","fillOpacity":0.7,"weight":1}', false, 1),
    ('Hidrografia_teste', 'Canais / Hidrografia', 'border-bottom: 2px solid #1F78B4; background: none; border-radius: 0;', '{"color":"#1F78B4","weight":2}', false, 2),
    ('Sub_bacias_teste', 'Sub-bacias', 'background-color: rgba(202, 178, 214, 0.3); border-color: #CAB2D6;', '{"color":"#CAB2D6","fillColor":"#CAB2D6","fillOpacity":0.2,"weight":1.5}', false, 3),
    ('Outorgas_Superficiais_teste', 'Outorgas Superficiais', 'background-color: #00BFFF; border-radius: 50%;', '{"radius":5,"fillColor":"#00BFFF","color":"#fff","weight":1,"fillOpacity":0.8}', false, 4),
    ('Outorgas_Subterraneas_teste', 'Outorgas Subterrâneas', 'background-color: #8A2BE2; border-radius: 50%;', '{"radius":5,"fillColor":"#8A2BE2","color":"#fff","weight":1,"fillOpacity":0.8}', false, 5)
) as v(layer_key, label, legend_style, style, default_active, sort_order)

union all
select client_id, id, v.layer_key, v.label, v.legend_style, v.style::jsonb, v.default_active, v.sort_order
from g4, (values
    ('Assentamentos_Rurais_teste', 'Assentamentos Rurais', 'background-color: rgba(251, 154, 153, 0.4); border-color: #FB9A99;', '{"color":"#FB9A99","fillColor":"#FB9A99","fillOpacity":0.3,"weight":1.5}', false, 1),
    ('Areas_Quilombolas_teste', 'Áreas Quilombolas', 'background-color: rgba(227, 26, 28, 0.4); border-color: #E31A1C;', '{"color":"#E31A1C","fillColor":"#E31A1C","fillOpacity":0.25,"weight":1.5}', false, 2),
    ('Terras_Indigenas_teste', 'Terras Indígenas', 'background-color: rgba(255, 127, 0, 0.4); border-color: #FF7F00;', '{"color":"#FF7F00","fillColor":"#FF7F00","fillOpacity":0.3,"weight":1.5}', false, 3),
    ('Patrimonio_Cultural_teste', 'Patrimônio Cultural', 'background-color: #FFD700; border-radius: 50%;', '{"radius":6,"fillColor":"#FFD700","color":"#222","weight":1.5,"fillOpacity":0.9}', false, 4),
    ('Sitios_Arqueologicos_teste', 'Sítios Arqueológicos', 'background-color: #FF4500; border-radius: 50%;', '{"radius":6,"fillColor":"#FF4500","color":"#fff","weight":1,"fillOpacity":0.9}', false, 5)
) as v(layer_key, label, legend_style, style, default_active, sort_order)

union all
select client_id, id, v.layer_key, v.label, v.legend_style, v.style::jsonb, v.default_active, v.sort_order
from g5, (values
    ('Erodibilidade_teste', 'Erodibilidade do Solo', 'background-color: rgba(177, 89, 40, 0.4); border-color: #B15928;', '{"color":"#B15928","fillColor":"#B15928","fillOpacity":0.3,"weight":1.5}', false, 1),
    ('BAZE_teste', 'Limite Bacia (BAZE)', 'background-color: rgba(150, 150, 150, 0.2); border: 1px solid #969696;', '{"color":"#969696","weight":2}', false, 2)
) as v(layer_key, label, legend_style, style, default_active, sort_order)

on conflict (client_id, layer_key) do update set
    label = excluded.label,
    legend_style = excluded.legend_style,
    style = excluded.style,
    default_active = excluded.default_active,
    sort_order = excluded.sort_order;
