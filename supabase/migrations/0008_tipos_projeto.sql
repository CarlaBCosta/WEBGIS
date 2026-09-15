-- Tipo de projeto de cada cliente (Bonsucro, ISCC, Due Diligence...).
--
-- Os tipos ficam no banco para novos serem incluídos sem mudar o código. Um
-- cliente pode ter mais de um projeto (ex.: Bonsucro e ISCC EU), guardados em
-- clients.projetos.
--
-- Rode no SQL Editor do Supabase depois de 0007_modelo_divisoes.sql.

create table if not exists tipos_projeto (
    id uuid primary key default gen_random_uuid(),
    nome text unique not null,
    sort_order integer not null default 0
);

alter table tipos_projeto enable row level security;

insert into tipos_projeto (nome, sort_order) values
    ('Bonsucro', 1),
    ('ISCC CORSIA', 2),
    ('ISCC EU', 3),
    ('ISCC PLUS', 4),
    ('Due Diligence', 5),
    ('Diagnóstico Ambiental', 6)
on conflict (nome) do nothing;

alter table clients add column if not exists projetos jsonb not null default '[]';
