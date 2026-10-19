-- Série de índices de vegetação da visão MUT (o gráfico do rodapé da prancha).
--
-- A equipe exporta do QGIS um CSV com uma linha por fazenda, classe de uso e
-- data: FAZENDA, CLASSE_08, Data_Fmt, NDVI, EVI. O painel importa esse arquivo
-- e o portal desenha uma linha por classe no painel da fazenda.
--
-- Também guarda o ano de referência do MUT (2008 nos projetos ISCC), usado nos
-- títulos do portal.
--
-- Rode no SQL Editor do Supabase depois de 0009_mut.sql (ou `npm run migrar`).

alter table mut_config add column if not exists ano_mut integer not null default 2008;

create table if not exists mut_indices (
    id bigserial primary key,
    client_id uuid not null references clients(id) on delete cascade,
    codigo text not null,
    classe text not null,
    data date not null,
    ndvi double precision,
    evi double precision
);

create index if not exists mut_indices_busca_idx on mut_indices (client_id, codigo);

alter table mut_indices enable row level security;

drop policy if exists "Public read mut_indices" on mut_indices;
create policy "Public read mut_indices" on mut_indices for select using (true);

notify pgrst, 'reload schema';
