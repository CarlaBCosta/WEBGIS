-- Camada das fazendas (Atlas) da visão MUT.
--
-- O projeto sai do QGIS em duas camadas que se completam:
--   MUT_2008 → um polígono por talhão, com a classe de uso do solo em 2008;
--   ATLAS    → um polígono por fazenda, com a elegibilidade, o nome, o período
--              e as coordenadas de consulta (o cabeçalho da prancha).
--
-- As duas se ligam pelo código da fazenda. Com o Atlas configurado, a cor de
-- elegibilidade passa a vir da fazenda (é assim que o ISCC avalia) e o painel
-- mostra o cabeçalho completo.
--
-- Rode no SQL Editor do Supabase depois de 0010_mut_indices.sql
-- (ou simplesmente `npm run migrar`).

alter table mut_config add column if not exists layer_fazendas text;
alter table mut_config add column if not exists campo_codigo_fazenda text;
alter table mut_config add column if not exists campo_nome text;
alter table mut_config add column if not exists campo_area_fazenda text;
alter table mut_config add column if not exists campo_periodo text;
alter table mut_config add column if not exists campo_latlong text;
alter table mut_config add column if not exists campo_elegibilidade_fazenda text;

notify pgrst, 'reload schema';
