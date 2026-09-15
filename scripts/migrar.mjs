// Aplica as migrations de supabase/migrations/ que ainda não rodaram no banco.
//
// Uso (na pasta webgis_portal):
//   npm run migrar            → mostra o que está pendente e aplica
//   npm run migrar -- --ver   → só mostra, não aplica
//
// Precisa de SUPABASE_DB_URL no .env.local: a "Connection string" do Supabase
// (Connect → Direct → Session pooler), com a senha do banco no lugar de
// [YOUR-PASSWORD]. Guarde essa linha só no .env.local / cofre de senhas.
//
// Controle: tabela schema_migrations (nome do arquivo + data). Cada migration
// roda numa transação — se falhar, nada dela fica aplicado.

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

// Migrations aplicadas à mão no SQL Editor antes deste comando existir.
const JA_APLICADAS_MANUALMENTE = [
  '0001_admin_panel_fields.sql',
  '0002_map_bounds_buffer.sql',
  '0003_group_templates.sql',
  '0004_created_by.sql',
  '0005_timelapse_robo.sql',
  '0006_timelapse_publico.sql',
];

const SO_VER = process.argv.includes('--ver');
const pasta = path.resolve('supabase', 'migrations');
const url = process.env.SUPABASE_DB_URL;

if (!url || url.includes('[YOUR-PASSWORD]') || url.includes('COLE-A-SENHA-AQUI')) {
  console.error(
    'ERRO: SUPABASE_DB_URL não está no .env.local (ou ainda sem a senha do banco).\n' +
      'Copie a connection string em Supabase → Connect → Direct → Session pooler e troque\n' +
      '[YOUR-PASSWORD] pela senha do banco.'
  );
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await cliente.connect();
} catch (erro) {
  const msg = String(erro.message);
  const dica = /password|authentication/i.test(msg)
    ? 'A senha do banco está errada. Confira ou redefina em Project Settings → Database.'
    : /ENOTFOUND|getaddrinfo/i.test(msg)
      ? 'Endereço não encontrado — o projeto pode estar pausado no Supabase.'
      : 'Confira a SUPABASE_DB_URL.';
  console.error(`ERRO ao conectar no banco: ${msg}\n${dica}`);
  process.exit(1);
}

try {
  await cliente.query(`create table if not exists schema_migrations (
    nome text primary key,
    aplicada_em timestamptz not null default now()
  )`);
  await cliente.query('alter table schema_migrations enable row level security');

  // Só registra 0001–0006 como aplicadas se o banco já tiver o que a 0006 cria
  // (banco que recebeu as migrations à mão). Num projeto novo, todas rodam.
  const { rows: vazias } = await cliente.query('select count(*)::int as n from schema_migrations');
  const { rows: tem0006 } = await cliente.query(
    `select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'timelapse_videos' and column_name = 'tamanho_bytes'`
  );
  if (vazias[0].n === 0 && tem0006.length > 0) {
    for (const nome of JA_APLICADAS_MANUALMENTE) {
      await cliente.query('insert into schema_migrations (nome) values ($1) on conflict do nothing', [nome]);
    }
    console.log(`Registradas como já aplicadas (feitas à mão antes): ${JA_APLICADAS_MANUALMENTE.length}`);
  }

  const { rows } = await cliente.query('select nome from schema_migrations');
  const aplicadas = new Set(rows.map((r) => r.nome));
  const arquivos = fs.readdirSync(pasta).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  const pendentes = arquivos.filter((f) => !aplicadas.has(f));

  if (pendentes.length === 0) {
    console.log('Banco em dia: nenhuma migration pendente.');
    process.exit(0);
  }
  console.log(`Pendentes: ${pendentes.join(', ')}`);
  if (SO_VER) process.exit(0);

  for (const nome of pendentes) {
    const sql = fs.readFileSync(path.join(pasta, nome), 'utf8');
    try {
      await cliente.query('begin');
      await cliente.query(sql);
      await cliente.query('insert into schema_migrations (nome) values ($1)', [nome]);
      await cliente.query('commit');
      console.log(`✓ ${nome}`);
    } catch (erro) {
      await cliente.query('rollback');
      console.error(`✗ ${nome}: ${erro.message}\nNada desta migration foi aplicado. As seguintes não rodaram.`);
      process.exit(1);
    }
  }
  // Faz a API do Supabase enxergar tabelas/colunas novas na hora.
  await cliente.query("notify pgrst, 'reload schema'");
  console.log('Migrations aplicadas.');
} finally {
  await cliente.end();
}
