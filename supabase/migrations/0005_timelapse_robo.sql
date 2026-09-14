-- Fila de geração de timelapses por fazenda + estado do robô.
--
-- O painel admin cria um pedido (timelapse_jobs); o robô
-- (scripts/timelapse/robo_timelapse.py) pega a fila, gera um vídeo por fazenda
-- e registra cada resultado em timelapse_videos. timelapse_robo guarda o último
-- sinal de vida do robô para o painel mostrar "online/offline".
--
-- Tudo com RLS ligado e SEM política pública: só o painel e o robô, usando a
-- chave secreta, leem e escrevem.
--
-- Rode no SQL Editor do Supabase depois de 0004_created_by.sql.

create table if not exists timelapse_jobs (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references clients(id) on delete cascade,
    layer_key text not null,
    campo text not null default 'FAZENDA',
    sensor text not null default 'landsat' check (sensor in ('landsat', 'sentinel2')),
    status text not null default 'pendente'
        check (status in ('pendente', 'processando', 'concluido', 'erro', 'cancelado')),
    total integer,
    concluidas integer not null default 0,
    falhas integer not null default 0,
    mensagem text,
    criado_por text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    heartbeat_at timestamptz
);

create index if not exists timelapse_jobs_status_idx on timelapse_jobs (status, created_at);
create index if not exists timelapse_jobs_client_idx on timelapse_jobs (client_id, created_at desc);

create table if not exists timelapse_videos (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references clients(id) on delete cascade,
    job_id uuid references timelapse_jobs(id) on delete set null,
    codigo text not null,
    sensor text not null default 'landsat',
    status text not null,
    anos text,
    cenas_por_ano text,
    avisos text,
    arquivo_local text,
    url text,
    updated_at timestamptz not null default now(),
    unique (client_id, codigo, sensor)
);

create table if not exists timelapse_robo (
    id integer primary key default 1 check (id = 1),
    ultimo_sinal timestamptz,
    versao text,
    maquina text
);

insert into timelapse_robo (id) values (1) on conflict (id) do nothing;

alter table timelapse_jobs enable row level security;
alter table timelapse_videos enable row level security;
alter table timelapse_robo enable row level security;
