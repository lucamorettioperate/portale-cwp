-- =====================================================================
--  34 — SICUREZZA: AVVISI, USCITA PER INATTIVITÀ, RINFORZI DEL DATABASE
--
--  Scopo (richiesta di Luca del 20/10/2026 «parti con la sicurezza»,
--  backlog 14 e 30):
--   1. AVVISI all'Amministratore principale (notifica nel portale e email,
--      come le altre notifiche, script 09 e 12):
--      - 5 accessi non riusciti per la stessa email in 15 minuti (possibile
--        tentativo di indovinare la password);
--      - 30 accessi non riusciti in tutto in un'ora (possibile attacco);
--      - un utente diventa Amministratore (nuovo o cambio di ruolo).
--   2. USCITA PER INATTIVITÀ: registra_uscita(motivo) registra anche il
--      motivo dell'uscita («inattività» quando il portale chiude da solo la
--      sessione dopo un periodo senza attività).
--   3. RINFORZI segnalati dal Security Advisor di Supabase:
--      - search_path fisso per le funzioni che non l'avevano;
--      - le funzioni SECURITY DEFINER non sono più eseguibili da chi non ha
--        fatto l'accesso (ruolo anon), tranne quelle che servono davvero
--        alle pagine pubbliche e quelle usate dentro le regole di accesso
--        (RLS); restano eseguibili dagli utenti collegati come prima.
--
--  Eseguire DOPO lo script 33, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 34; backlog 14, 30.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. AVVISI ALL'AMMINISTRATORE PRINCIPALE
-- ---------------------------------------------------------------------
-- Id dell'Amministratore principale senza controlli sul chiamante (uso
-- interno, anche da funzioni chiamate senza accesso).
create or replace function cwp_principale()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from profilo where amministratore_principale and attivo limit 1;
$$;
revoke execute on function cwp_principale() from public, anon, authenticated;

-- Notifica all'Amministratore principale (evento «sicurezza»). Non parte
-- se è lui stesso ad aver causato l'evento (cwp_notifica lo esclude).
create or replace function cwp_avviso_sicurezza(p_titolo text, p_testo text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_p uuid := cwp_principale();
begin
  if v_p is not null then
    perform cwp_notifica(array[v_p], null, 'sicurezza', p_titolo, p_testo);
  end if;
end $$;
revoke execute on function cwp_avviso_sicurezza(text, text) from public, anon, authenticated;

-- Tentativo non riuscito (script 33) con gli avvisi: alla 5ª volta in 15
-- minuti per la stessa email e alla 30ª in un'ora in tutto. Gli avvisi
-- partono una volta sola per soglia, perché il conteggio la attraversa una
-- volta (e oltre 10 per email il registro smette di contare).
create or replace function registra_accesso_fallito(p_email text)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text := lower(trim(left(coalesce(p_email, ''), 254)));
  v_id uuid;
  v_email_15 int;
  v_ora int;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return;
  end if;
  select count(*) into v_email_15 from registro_accessi
   where evento = 'accesso_non_riuscito' and lower(email) = v_email and avvenuto_il > now() - interval '15 minutes';
  select count(*) into v_ora from registro_accessi
   where evento = 'accesso_non_riuscito' and avvenuto_il > now() - interval '1 hour';
  if v_email_15 >= 10 or v_ora >= 300 then
    return;
  end if;
  select id into v_id from auth.users where lower(email) = v_email limit 1;
  insert into registro_accessi (utente_id, email, evento, dettaglio)
  values (v_id, v_email, 'accesso_non_riuscito', jsonb_build_object('utente_esistente', v_id is not null));
  if v_email_15 + 1 = 5 then
    perform cwp_avviso_sicurezza(
      'Accessi non riusciti ripetuti',
      '5 tentativi di accesso non riusciti in 15 minuti per ' || v_email ||
      case when v_id is null then ' (email non registrata nel portale).' else '. Verifica in Audit User → Accessi.' end);
  end if;
  if v_ora + 1 = 30 then
    perform cwp_avviso_sicurezza(
      'Molti accessi non riusciti',
      '30 tentativi di accesso non riusciti nell''ultima ora, su più email: possibile attacco. Verifica in Audit User → Accessi.');
  end if;
end $$;
grant execute on function registra_accesso_fallito(text) to anon, authenticated;

-- Nuovo Amministratore: avviso quando un profilo diventa admin.
create or replace function profilo_avviso_admin()
returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare v_email text;
begin
  if new.ruolo = 'admin' and (tg_op = 'INSERT' or old.ruolo is distinct from 'admin') then
    select email into v_email from auth.users where id = new.id;
    perform cwp_avviso_sicurezza(
      'Nuovo Amministratore',
      coalesce(new.nome_completo || ' (' || v_email || ')', v_email, 'Un utente') ||
      ' ha ora il ruolo di Amministratore, con accesso completo ai dati. Se non te l''aspettavi, controlla in Utenti e in Audit User.');
  end if;
  return null;
end $$;
drop trigger if exists trg_profilo_avviso_admin on profilo;
create trigger trg_profilo_avviso_admin
  after insert or update of ruolo on profilo
  for each row execute function profilo_avviso_admin();


-- ---------------------------------------------------------------------
-- 2. USCITA CON IL MOTIVO (Esci oppure inattività)
-- ---------------------------------------------------------------------
-- Sostituisce registra_uscita() dello script 33 con una versione che
-- accetta il motivo (facoltativo): 'inattivita' quando il portale chiude
-- la sessione da solo. Chi la chiama senza parametri ottiene lo stesso
-- risultato di prima.
drop function if exists registra_uscita();
create or replace function registra_uscita(p_motivo text default null)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_dal timestamptz;
begin
  if auth.uid() is null then
    return;
  end if;
  select collegato_dal into v_dal from presenza where utente_id = auth.uid();
  insert into registro_accessi (utente_id, email, evento, dettaglio)
  select auth.uid(), u.email, 'uscita',
         jsonb_strip_nulls(jsonb_build_object(
           'minuti_collegato', case when v_dal is null then null else round(extract(epoch from now() - v_dal) / 60) end,
           'motivo', case when p_motivo = 'inattivita' then 'inattivita' end))
    from auth.users u where u.id = auth.uid();
  delete from presenza where utente_id = auth.uid();
end $$;
grant execute on function registra_uscita(text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. RINFORZI DAL SECURITY ADVISOR
-- ---------------------------------------------------------------------
do $$
declare
  f record;
  -- Funzioni che devono restare eseguibili senza accesso: la registrazione
  -- dei tentativi non riusciti (pagina di accesso).
  v_anon_ok text[] := array['registra_accesso_fallito'];
  -- Funzioni usate nelle regole di accesso (RLS) di qualunque tabella:
  -- restano eseguibili da tutti, altrimenti le regole stesse darebbero
  -- errore anche a chi non è collegato.
  v_in_policy text[];
begin
  select coalesce(array_agg(distinct m[1]), '{}') into v_in_policy
    from pg_policies p,
         regexp_matches(coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''), '([a-z_][a-z0-9_]*)\(', 'g') as m;

  -- 3a. search_path fisso dove manca (escluse le funzioni delle estensioni).
  for f in
    select p.oid, p.oid::regprocedure as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions', f.firma);
  end loop;

  -- 3b. SECURITY DEFINER: niente esecuzione per anon (e per PUBLIC), ma sì
  --     per gli utenti collegati e per il server, se prima l'avevano.
  for f in
    select p.oid, p.oid::regprocedure as firma, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and has_function_privilege('anon', p.oid, 'execute')
       and not (p.proname = any (v_anon_ok))
       and not (p.proname = any (v_in_policy))
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated, service_role', f.firma);
  end loop;
end $$;

-- Le funzioni interne di questo script restano chiuse a tutti (il grant
-- del passo 3b non le riguarda: non erano eseguibili da anon).
revoke execute on function cwp_principale() from public, anon, authenticated;
revoke execute on function cwp_avviso_sicurezza(text, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. VERIFICA
-- ---------------------------------------------------------------------
-- Funzioni SECURITY DEFINER ancora eseguibili senza accesso: devono essere
-- solo registra_accesso_fallito e quelle usate nelle regole di accesso.
select p.proname as eseguibile_senza_accesso
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
 order by 1;
