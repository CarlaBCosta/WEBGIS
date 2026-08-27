-- Auditoria simples de autoria: quem criou cada cliente. O nome vem do
-- login do painel admin (campo "Seu nome"), guardado no cookie da sessão.
-- Rode no SQL Editor do Supabase depois de 0003_group_templates.sql.

alter table clients add column if not exists created_by text;
