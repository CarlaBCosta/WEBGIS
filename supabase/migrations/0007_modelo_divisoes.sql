-- Modelo de divisões (grupos temáticos) com descrição, editável no painel admin.
--
-- layer_group_templates é o modelo global: todo cliente novo recebe essas
-- divisões. Cada cliente pode incluir ou excluir divisões só para si
-- (layer_groups); template_id lembra de qual divisão do modelo o grupo veio.
--
-- Rode no SQL Editor do Supabase depois de 0006_timelapse_publico.sql.

alter table layer_group_templates add column if not exists descricao text not null default '';

alter table layer_groups add column if not exists descricao text not null default '';
alter table layer_groups add column if not exists template_id uuid
    references layer_group_templates(id) on delete set null;

-- "Empreendimento" passa a se chamar "Camadas Principais".
update layer_group_templates set title = 'Camadas Principais'
where title = 'Empreendimento'
  and not exists (select 1 from layer_group_templates where title = 'Camadas Principais');

update layer_group_templates set descricao = 'Usina, ADA, AID, Fazendas, Talhões, Municípios, Estados'
where title = 'Camadas Principais';
update layer_group_templates set descricao = 'Rodovias, Ferrovias, Linhas de Transmissão, Gasodutos, Oleodutos, Barragens, Aeroportos, Portos'
where title = 'Infraestrutura';
update layer_group_templates set descricao = 'Hidrografia, Corpos d''Água, Sub-bacias, UGRHIs, Pedologia'
where title = 'Base Cartográfica';
update layer_group_templates set descricao = 'CAR, Assentamentos, Embargos Federais, Embargos Estaduais, Autos de Infração Federais'
where title = 'Análise Fundiária';
update layer_group_templates set descricao = 'APP, Reserva Legal, Vegetação Nativa, Unidades de Conservação, RAMSAR, BirdLife/IBA, Turfeiras, Áreas Prioritárias para Conservação, Espécies Ameaçadas'
where title = 'Biodiversidade e Ecossistemas (AVC 1, 2 e 3)';
update layer_group_templates set descricao = 'Nascentes, Aquíferos, Áreas Úmidas, Outorgas, Erodibilidade, Suscetibilidade à Erosão'
where title = 'Serviços Ecossistêmicos (AVC 4)';
update layer_group_templates set descricao = 'Terras Indígenas, Quilombolas, Comunidades Tradicionais, Patrimônio Cultural, Sítios Arqueológicos'
where title = 'Comunidades e Patrimônio Cultural (AVC 5 e 6)';

-- Palavras-chave novas para classificar os temas citados nas descrições.
update layer_group_templates
set keywords = keywords || '["area_prioritaria","areas_prioritarias"]'::jsonb
where title = 'Biodiversidade e Ecossistemas (AVC 1, 2 e 3)'
  and not keywords ? 'areas_prioritarias';
