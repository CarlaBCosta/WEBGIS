-- Coluna do Atlas que guarda a área de cada classe de uso.
--
-- No ATLAS cada fazenda traz a área de 2008 em uma coluna por classe
-- (CANA08, LAV08, PLANT08, VEG08...). Guardando aqui qual coluna é de qual
-- classe, o painel da fazenda monta a legenda com os mesmos números da prancha,
-- somando exatamente a área total da fazenda — e isso continua configurável,
-- sem nome de coluna escrito no código.
--
-- Rode no SQL Editor do Supabase depois de 0011_mut_fazendas.sql
-- (ou simplesmente `npm run migrar`).

alter table mut_classes add column if not exists campo_atlas text;

update mut_classes set campo_atlas = 'PLANT08'  where client_id is null and nome = 'Pastagem Plantada'  and campo_atlas is null;
update mut_classes set campo_atlas = 'CANA08'   where client_id is null and nome = 'Cana-de-Açúcar'     and campo_atlas is null;
update mut_classes set campo_atlas = 'SILV08'   where client_id is null and nome = 'Silvicultura'       and campo_atlas is null;
update mut_classes set campo_atlas = 'LAV08'    where client_id is null and nome = 'Lavoura de Grãos'   and campo_atlas is null;
update mut_classes set campo_atlas = 'CULT08'   where client_id is null and nome = 'Culturas Perenes'   and campo_atlas is null;
update mut_classes set campo_atlas = 'FORM08'   where client_id is null and nome = 'Formação Campestre' and campo_atlas is null;
update mut_classes set campo_atlas = 'VEG08'    where client_id is null and nome = 'Vegetação Nativa'   and campo_atlas is null;
update mut_classes set campo_atlas = 'CAMP08'   where client_id is null and nome = 'Campo Alagado'      and campo_atlas is null;
update mut_classes set campo_atlas = 'NAOVEG08' where client_id is null and nome = 'Área não Vegetada'  and campo_atlas is null;

notify pgrst, 'reload schema';
