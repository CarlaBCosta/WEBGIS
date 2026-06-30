# Portal WebGIS AMBIUM Digital

Plataforma WebGIS multi-cliente (Next.js + Supabase). Uma única aplicação serve todos os clientes via `/cliente/<slug>`; identidade do cliente, camadas, estilos e arquivos GeoJSON vivem no Supabase (Postgres + Storage), não no código.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Leaflet + Turf.js · Supabase (Postgres + Storage).

## Setup local

```bash
npm install
cp .env.example .env.local   # preencha as chaves do Supabase e ADMIN_PANEL_SECRET
npm run dev
```

- Portal público: `http://localhost:3000/cliente/<slug>`
- Painel admin: `http://localhost:3000/admin` (senha = `ADMIN_PANEL_SECRET`)

## Banco de dados

1. Rode `supabase/schema.sql` no SQL Editor do Supabase (base: tabelas `clients`, `layer_groups`, `layers`).
2. Rode `supabase/migrations/0001_admin_panel_fields.sql` (campos usados pelo painel admin: `logo_url`, `primary_color`, `is_active`, `storage_path`, etc.).
3. Crie o bucket público `client-data` em Storage, se ainda não existir.

## Cadastrar um novo cliente (via painel admin, sem código)

1. Acesse `/admin/clientes/novo` e preencha nome, centro/zoom do mapa e cor.
2. Em `/admin/clientes/<slug>/camadas`, crie os grupos temáticos (ex: "Empreendimento", "Recursos Hídricos").
3. Em `/admin/clientes/<slug>/upload`, envie cada arquivo `.geojson`:
   - Se o arquivo estiver em SIRGAS 2000 / UTM 22S (EPSG:31982), marque "Reprojetar".
   - Defina cor, opacidade, espessura/raio e se a camada deve vir ativa por padrão.
4. O portal em `/cliente/<slug>` reflete as mudanças automaticamente (sem redeploy).

## CLI de fallback (importação em lote / clientes legados)

Para clientes que ainda usam o fluxo antigo de export do QGIS local, os scripts CLI continuam funcionando:

```bash
npm run preprocess <id-do-cliente>   # reprojeta/simplifica para ./processed/<id-do-cliente>
npm run upload-cliente <id-do-cliente>
```

## Arquivos legados (pré-migração Next.js)

`index.html`, `shared/app.js`, `shared/supabase-config.js` e `cliente-configs/*.json` correspondem à versão anterior (HTML/JS puro) do portal e não são mais servidos pela aplicação Next.js. Mantidos temporariamente como referência; remover após confirmar paridade visual completa do novo portal em produção.
