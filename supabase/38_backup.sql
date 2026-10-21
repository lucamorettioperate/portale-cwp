-- =====================================================================
--  38 — BACKUP: TUTTO IL DATABASE IN UNA SOLA CHIAMATA
--
--  Scopo (richiesta di Luca Moretti del 21/10/2026): il backup giornaliero
--  delle 20:00 gira sul Mac di Luca (strumenti/backup/backup_cwp_mac.sh,
--  launchd) e scrive nella cartella «Cwp/backup» di Google Drive
--  attraverso l'app Google Drive per desktop. Il backup in Google Apps
--  Script non si può usare: Google blocca i programmi personali
--  sull'account di Luca.
--
--  Cosa crea: la funzione backup_completo(), che restituisce in un solo
--  JSON:
--   - tabelle: tutte le tabelle dello schema public, righe complete;
--   - auth_utenti: gli utenti dell'autenticazione (id, email, date,
--     metadati) SENZA password;
--   - file_storage: l'elenco dei file degli archivi (bucket, percorso,
--     dimensione), che lo script poi scarica uno per uno;
--   - lavori_pianificati: i lavori pg_cron (nome, orario, comando).
--  Lo stesso formato del backup manuale: si ripristina con
--  strumenti/backup/genera_sql_ripristino.mjs database_completo.json.
--
--  Sicurezza: la può eseguire SOLO la chiave service_role (che resta nel
--  Portachiavi del Mac di Luca); a chiunque altro l'esecuzione è tolta.
--
--  Eseguire DOPO lo script 37, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 38;
--  Istruzioni di ripristino, capitolo «Backup automatico».
-- =====================================================================

create or replace function public.backup_completo()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  tabelle jsonb := '{}'::jsonb;
  righe json;
  lavori json := '[]'::json;
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('select coalesce(json_agg(x), ''[]''::json) from public.%I x', t.tablename) into righe;
    tabelle := tabelle || jsonb_build_object(t.tablename, righe);
  end loop;
  -- Lavori pianificati (solo se pg_cron è attivo).
  if to_regclass('cron.job') is not null then
    execute 'select coalesce(json_agg(json_build_object(''jobname'', jobname, ''schedule'', schedule, ''command'', command, ''active'', active) order by jobname), ''[]''::json) from cron.job'
      into lavori;
  end if;
  return json_build_object(
    'creato_il', now(),
    'tabelle', tabelle,
    'auth_utenti', (
      select coalesce(json_agg(json_build_object(
        'id', u.id, 'email', u.email, 'email_confirmed_at', u.email_confirmed_at, 'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at, 'app_metadata', u.raw_app_meta_data, 'user_metadata', u.raw_user_meta_data,
        'banned_until', u.banned_until) order by u.created_at), '[]'::json)
      from auth.users u),
    'file_storage', (
      select coalesce(json_agg(json_build_object('bucket', o.bucket_id, 'path', o.name, 'dimensione', o.metadata->>'size') order by o.bucket_id, o.name), '[]'::json)
      from storage.objects o
      where o.name is not null and right(o.name, 1) <> '/'),
    'lavori_pianificati', lavori
  );
end $$;

revoke execute on function public.backup_completo() from public, anon, authenticated;
grant execute on function public.backup_completo() to service_role;

-- Verifica (solo lettura): numero di tabelle che il backup contiene.
select count(*) as tabelle_nel_backup from pg_tables where schemaname = 'public';
