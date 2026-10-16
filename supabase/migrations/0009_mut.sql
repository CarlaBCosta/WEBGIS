-- Visão MUT (Mudança do Uso do Solo).
--
-- A camada MUT é a mesma que vem do QGIS (talhões com uso do solo e
-- elegibilidade). O que muda é a leitura: no portal ela ganha uma visão
-- própria, com cor por elegibilidade ou por classe de uso, dados no hover e um
-- painel que substitui a prancha estática.
--
-- mut_config: um registro por cliente dizendo qual camada é a MUT e em que
-- campo está cada informação. Fica no banco para cliente novo não precisar de
-- código. mut_classes: catálogo das classes de uso com a cor de cada uma —
-- client_id nulo é o modelo global, com client_id é exceção daquele cliente.
--
-- Rode no SQL Editor do Supabase depois de 0008_tipos_projeto.sql
-- (ou simplesmente `npm run migrar`).

create table if not exists mut_config (
    client_id uuid primary key references clients(id) on delete cascade,
    layer_key text not null,
    campo_codigo text not null default 'FAZENDA',
    campo_talhao text,
    campo_area text,
    campo_elegibilidade text not null default 'ELEG',
    -- Valores do campo acima que significam "elegível"; o resto é inelegível.
    valores_elegivel jsonb not null default '["ELEGÍVEL"]',
    campo_uso text,
    nome_fazenda text not null default '',
    safra text not null default '',
    ano_inicial integer not null default 2007,
    ativo boolean not null default true,
    updated_at timestamptz not null default now()
);

create table if not exists mut_classes (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    nome text not null,
    cor text not null,
    sort_order integer not null default 0
);

-- Nome único dentro do modelo global e dentro de cada cliente (no Postgres dois
-- nulos são distintos, por isso o índice do modelo é separado).
create unique index if not exists mut_classes_modelo_nome_idx
    on mut_classes (lower(nome)) where client_id is null;
create unique index if not exists mut_classes_cliente_nome_idx
    on mut_classes (client_id, lower(nome)) where client_id is not null;

alter table mut_config enable row level security;
alter table mut_classes enable row level security;

-- O portal lê com a chave publicável; escrita só pelo painel (chave secreta).
drop policy if exists "Public read mut_config" on mut_config;
create policy "Public read mut_config" on mut_config for select using (true);
drop policy if exists "Public read mut_classes" on mut_classes;
create policy "Public read mut_classes" on mut_classes for select using (true);

-- Modelo global semeado com a legenda de uso do solo das pranchas, na mesma
-- ordem e com as mesmas cores. Tudo editável no painel.
insert into mut_classes (client_id, nome, cor, sort_order) values
    (null, 'Pastagem Plantada',  '#C800FF', 1),
    (null, 'Cana-de-Açúcar',     '#111111', 2),
    (null, 'Silvicultura',       '#8B5A00', 3),
    (null, 'Lavoura de Grãos',   '#FFD700', 4),
    (null, 'Culturas Perenes',   '#FF8C00', 5),
    (null, 'Formação Campestre', '#ADFF2F', 6),
    (null, 'Vegetação Nativa',   '#00A000', 7),
    (null, 'Campo Alagado',      '#5F9EA0', 8),
    (null, 'Área não Vegetada',  '#FF0000', 9)
on conflict do nothing;

notify pgrst, 'reload schema';
