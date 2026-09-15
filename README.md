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

As mudanças de estrutura ficam em `supabase/migrations/` (numeradas) e são aplicadas pelo comando:

```bash
npm run migrar            # aplica as pendentes, em ordem, cada uma numa transação
npm run migrar -- --ver   # só lista as pendentes
```

Requer `SUPABASE_DB_URL` no `.env.local`: a connection string do Supabase
(**Connect → Direct → Session pooler**) com a senha do banco. A tabela `schema_migrations`
registra o que já rodou (0001–0006 foram aplicadas à mão e ficaram registradas na primeira
execução). Ao criar uma migration nova, basta adicionar o arquivo `00NN_nome.sql` e rodar o comando.

Projeto novo do zero: rode `supabase/schema.sql` no SQL Editor, crie os buckets públicos
`client-data` e `timelapses` em Storage e depois `npm run migrar`.

## Cadastrar um novo cliente (via painel admin, sem código)

1. Acesse `/admin/clientes/novo` e preencha nome, centro/zoom do mapa e cor. O campo "Buffer da extensão máxima" (padrão 30 km) define até onde o usuário consegue navegar/dar zoom ao redor da área de estudo (AID): o portal calcula o bbox da camada indicada em "Layer key da área de estudo", soma o buffer e trava o mapa nessa extensão (`maxBounds` + zoom mínimo). O zoom inicial e o botão "Centralizar" usam essa mesma extensão.
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
