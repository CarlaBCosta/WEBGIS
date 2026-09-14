-- Exibição pública dos timelapses no portal.
--
-- O robô publica uma versão web de cada vídeo no bucket público "timelapses" do
-- Supabase Storage e grava a URL em timelapse_videos.url. O portal (chave
-- publicável) lê só as linhas já publicadas; a fila (timelapse_jobs) e o sinal
-- do robô (timelapse_robo) continuam fechados.
--
-- tamanho_bytes guarda o tamanho publicado: o robô soma para não estourar o
-- limite de armazenamento do plano do Supabase.
--
-- Rode no SQL Editor do Supabase depois de 0005_timelapse_robo.sql.

alter table timelapse_videos add column if not exists layer_key text;
alter table timelapse_videos add column if not exists tamanho_bytes bigint;

create index if not exists timelapse_videos_portal_idx
    on timelapse_videos (client_id, layer_key, codigo);

drop policy if exists "Public read published timelapse_videos" on timelapse_videos;
create policy "Public read published timelapse_videos" on timelapse_videos
    for select using (url is not null);
