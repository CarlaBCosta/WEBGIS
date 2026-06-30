-- Migration aditiva para suportar o painel administrativo (cadastro de
-- clientes via UI, upload de GeoJSON, reordenação). Rode no SQL Editor do
-- Supabase depois de supabase/schema.sql já estar aplicado.

alter table clients add column if not exists logo_url text;
alter table clients add column if not exists primary_color text default '#9ACD32';
alter table clients add column if not exists is_active boolean not null default true;
alter table clients add column if not exists updated_at timestamptz not null default now();

alter table layers add column if not exists storage_path text;
alter table layers add column if not exists geometry_type text;
alter table layers add column if not exists feature_count integer;
alter table layers add column if not exists updated_at timestamptz not null default now();

-- Leitura pública só deve expor clientes ativos; clientes desativados pelo
-- admin devem retornar 404 no portal (/cliente/[slug] chama notFound()).
drop policy if exists "Public read clients" on clients;
create policy "Public read active clients" on clients for select using (is_active = true);

-- (layer_groups/layers continuam com leitura pública irrestrita - a
-- visibilidade de um cliente inteiro é controlada pela policy acima sobre
-- clients; layers nunca são listados fora do contexto de um client_id já
-- resolvido a partir de um slug ativo)
