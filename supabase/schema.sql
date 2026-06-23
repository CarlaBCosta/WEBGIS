-- Portal WebGIS AMBIUM - schema multi-cliente
-- Rode isso uma vez no SQL Editor do Supabase (Project > SQL Editor > New query).

create extension if not exists pgcrypto; -- para gen_random_uuid()

create table if not exists clients (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,
    name text not null,
    map_center_lat double precision not null default -21.90,
    map_center_lng double precision not null default -48.67,
    map_zoom integer not null default 11,
    zoom_to_layer text,
    farm_code_fields jsonb not null default '["FAZENDA","CHAVE_USIN","CHAVE_AMB","PROPRIEDAD","cod_imovel"]',
    created_at timestamptz not null default now()
);

create table if not exists layer_groups (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references clients(id) on delete cascade,
    title text not null,
    sort_order integer not null default 0
);

create table if not exists layers (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references clients(id) on delete cascade,
    group_id uuid not null references layer_groups(id) on delete cascade,
    layer_key text not null,           -- nome do arquivo no Storage: <layer_key>.geojson
    label text not null,
    legend_style text default '',
    style jsonb not null default '{}', -- {color, fillColor, fillOpacity, weight, dashArray, radius}
    default_active boolean not null default false,
    sort_order integer not null default 0,
    unique (client_id, layer_key)
);

-- Leitura pública (a publishable/anon key só consegue SELECT, nunca
-- INSERT/UPDATE/DELETE - isso fica reservado pra secret key, usada só
-- localmente pelo script de upload).
alter table clients enable row level security;
alter table layer_groups enable row level security;
alter table layers enable row level security;

create policy "Public read clients" on clients for select using (true);
create policy "Public read layer_groups" on layer_groups for select using (true);
create policy "Public read layers" on layers for select using (true);

-- Bucket de Storage para os .geojson exportados do QGIS (crie manualmente em
-- Storage > New bucket > nome "client-data" > marque "Public bucket", OU
-- descomente e rode o bloco abaixo no SQL Editor).
-- insert into storage.buckets (id, name, public) values ('client-data', 'client-data', true)
-- on conflict (id) do nothing;
