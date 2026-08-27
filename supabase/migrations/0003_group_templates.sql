-- Taxonomia padrão de grupos temáticos (7 grupos) + fonte por camada.
--
-- Os grupos ficam no banco (não no código): o cadastro de clientes usa esta
-- tabela para classificar automaticamente cada GeoJSON enviado no grupo
-- certo, via palavras-chave. Novos temas/palavras podem ser adicionados por
-- SQL ou, futuramente, pelo painel admin. Cada cliente recebe apenas os
-- grupos em que de fato tiver camadas.
--
-- Convenção de arquivo: NOMEDACAMADA_FONTE.geojson (ex: Hidrografia_ANA
-- .geojson) — o último segmento vira a fonte, salva em layers.source.
--
-- Rode no SQL Editor do Supabase depois de 0002_map_bounds_buffer.sql.

create table if not exists layer_group_templates (
    id uuid primary key default gen_random_uuid(),
    title text unique not null,
    objective text not null default '',
    sort_order integer not null default 0,
    keywords jsonb not null default '[]'
);

alter table layer_group_templates enable row level security;
drop policy if exists "Public read layer_group_templates" on layer_group_templates;
create policy "Public read layer_group_templates" on layer_group_templates for select using (true);

alter table layers add column if not exists source text;

insert into layer_group_templates (title, objective, sort_order, keywords) values
(
  'Empreendimento',
  'Delimitação da área de estudo',
  1,
  '["usina","ada","aid","fazenda","fazendas","talhao","talhoes","municipio","municipios","estado","estados","area_de_estudo","buffer","area_industrial","viveiro","viveiros","estrada","estradas","monitoramento","influencia","diretamente_afetada","empreendimento"]'
),
(
  'Infraestrutura',
  'Infraestrutura existente e empreendimentos associados',
  2,
  '["rodovia","rodovias","ferrovia","ferrovias","linha_de_transmissao","linhas_de_transmissao","transmissao","gasoduto","gasodutos","oleoduto","oleodutos","barragem","barragens","aeroporto","aeroportos","porto","portos","subestacao","subestacoes","mineroduto","minerodutos","hidrovia","hidrovias","usinas_vizinhas","usina_vizinha","pch","pchs","licenciado","licenciados","torre","torres","telecomunicacao"]'
),
(
  'Base Cartográfica',
  'Dados físicos e cartográficos de referência',
  3,
  '["hidrografia","corpos_dagua","corpo_dagua","sub_bacia","sub_bacias","subbacia","subbacias","ugrhi","ugrhis","pedologia","geologia","declividade","mdt","modelo_digital","terreno","hipsometria","mapbiomas","uso_e_cobertura","uso_da_terra","solo","solos","bacia","bacias","clima","isoieta","isoietas"]'
),
(
  'Análise Fundiária',
  'Regularização fundiária e restrições legais',
  4,
  '["car","sicar","assentamento","assentamentos","embargo","embargos","auto_de_infracao","autos_de_infracao","infracao","sigef","incra","imovel_rural","imoveis_rurais","terra_publica","terras_publicas","gleba","glebas","fundiario","fundiaria","fundiarios","cadastro_ambiental"]'
),
(
  'Biodiversidade e Ecossistemas (AVC 1, 2 e 3)',
  'Avaliação da biodiversidade, habitats e ecossistemas',
  5,
  '["app","preservacao_permanente","reserva_legal","vegetacao","unidade_de_conservacao","unidades_de_conservacao","conservacao","uc","ramsar","birdlife","iba","turfeira","turfeiras","prioritaria","prioritarias","especie","especies","ameacada","ameacadas","corredor","corredores","fragmento","fragmentos","rppn","amortecimento","nucleo","biodiversidade","endemica","endemicas","habitat","caverna","cavernas","remanescente","remanescentes"]'
),
(
  'Serviços Ecossistêmicos (AVC 4)',
  'Avaliação dos serviços ambientais e recursos naturais',
  6,
  '["nascente","nascentes","aquifero","aquiferos","area_umida","areas_umidas","umida","umidas","outorga","outorgas","erodibilidade","erosao","recarga","vulnerabilidade","app_hidrica","hidrica","qualidade_da_agua","poco","pocos","vazao","vazoes","inundavel","inundaveis","suscetibilidade"]'
),
(
  'Comunidades e Patrimônio Cultural (AVC 5 e 6)',
  'Aspectos sociais, culturais e patrimônio',
  7,
  '["terra_indigena","terras_indigenas","indigena","indigenas","quilombola","quilombolas","tradicional","tradicionais","patrimonio","sitio_arqueologico","sitios_arqueologicos","arqueologico","arqueologicos","tombado","tombados","pesqueiro","pesqueiros","ribeirinha","ribeirinhas","povos","imaterial","escola","escolas","saude","uso_comunitario","comunitario","comunidade","comunidades"]'
)
on conflict (title) do update set
  objective = excluded.objective,
  sort_order = excluded.sort_order,
  keywords = excluded.keywords;
