-- =====================================================================
--  36 — NEWS: OSSERVATORIO SUI CREDITI DI CARBONIO VOLONTARI
--
--  Scopo (richiesta di Luca Moretti del 21/10/2026): una sezione «News»
--  solo per gli Amministratori che ogni 2 ore cerca notizie sul mondo dei
--  crediti di carbonio volontari: mercato volontario, marketplace e borse
--  di scambio, prezzi dei crediti scambiati o venduti, standard e registri,
--  regole, progetti (in particolare rifiuti ed economia circolare). Ogni
--  notizia è controllata da Claude (funzione del server «notizie»): si
--  tengono solo quelle attinenti, con una sintesi in italiano.
--
--  Cosa crea:
--   - tabella notizia: una riga per notizia trovata, attinente o scartata
--     (le scartate restano per non rivalutarle e per controllare il
--     filtro; nella pagina si vedono a richiesta);
--   - tabella notizie_esecuzione: registro di ogni ricerca (quando, chi
--     l'ha chiesta, quante notizie lette, nuove, attinenti, esito);
--   - funzione notizie_puo_partire: la funzione del server chiede al
--     database se può partire (al massimo una ricerca ogni 100 minuti se
--     chiamata dal lavoro pianificato o senza accesso, ogni 10 minuti se
--     la chiede un Amministratore): così una chiamata esterna non può far
--     spendere crediti di Claude;
--   - funzione richiedi_aggiornamento_notizie e lavoro pg_cron
--     «cwp_notizie» ogni 2 ore (minuto 7): chiama la funzione del server
--     con pg_net, come le email (script 12);
--   - impostazione url_notizie (indirizzo della funzione).
--
--  Sicurezza: le tabelle si leggono solo dagli Amministratori (RLS con
--  app_is_admin); si scrivono solo dalla funzione del server (chiave di
--  servizio); l'Amministratore può solo nascondere o mostrare una
--  notizia (colonna nascosta, funzione notizia_nascondi).
--
--  Eseguire DOPO lo script 35, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni. Dopo l'esecuzione va pubblicata la funzione
--  «notizie» (Verify JWT DISATTIVATO, vedi supabase/functions/notizie).
--  Registro sviluppo e deploy: capitolo «Database», script 36; capitolo 5
--  «Edge Functions» (notizie).
-- =====================================================================

create table if not exists notizia (
  id            bigint generated always as identity primary key,
  url           text not null unique,              -- indirizzo dell'articolo (o del rimando di Google News)
  chiave        text not null unique,              -- titolo normalizzato: la stessa notizia da due ricerche entra una volta
  titolo        text not null,                     -- titolo originale
  titolo_it     text,                              -- titolo in italiano (tradotto se serve)
  fonte         text,                              -- testata o sito
  pubblicata_il timestamptz,                       -- data dell'articolo
  trovata_il    timestamptz not null default now(),
  ricerca       text,                              -- ricerca o canale che l'ha trovata
  lingua        text,                              -- it, en…
  attinente     boolean not null default false,    -- giudizio del filtro
  categoria     text check (categoria in ('prezzi', 'marketplace', 'standard_registri', 'regole', 'progetti', 'mercato', 'altro')),
  rilevanza     smallint check (rilevanza between 1 and 5),
  sintesi       text,                              -- 2-3 frasi in italiano
  prezzi        text,                              -- valori unitari citati (es. «N-GEO 0,45 $/t su CBL»)
  motivo        text,                              -- perché è (o non è) attinente
  nascosta      boolean not null default false     -- nascosta da un Amministratore
);
create index if not exists notizia_pubblicata_idx on notizia (pubblicata_il desc);
create index if not exists notizia_attinente_idx on notizia (attinente, nascosta);
alter table notizia enable row level security;

drop policy if exists notizia_admin_lettura on notizia;
create policy notizia_admin_lettura on notizia for select using (app_is_admin());

create table if not exists notizie_esecuzione (
  id           bigint generated always as identity primary key,
  avviata_il   timestamptz not null default now(),
  conclusa_il  timestamptz,
  origine      text not null check (origine in ('pianificata', 'manuale')),
  utente_id    uuid references auth.users(id) on delete set null,
  esito        text not null default 'in_corso' check (esito in ('in_corso', 'ok', 'errore')),
  lette        int not null default 0,   -- notizie lette dai canali
  nuove        int not null default 0,   -- mai viste prima
  attinenti    int not null default 0,   -- nuove e attinenti
  token_ingresso int not null default 0,
  token_uscita   int not null default 0,
  errore       text
);
create index if not exists notizie_esecuzione_avviata_idx on notizie_esecuzione (avviata_il desc);
alter table notizie_esecuzione enable row level security;

drop policy if exists notizie_esecuzione_admin on notizie_esecuzione;
create policy notizie_esecuzione_admin on notizie_esecuzione for select using (app_is_admin());

-- Permessi: la funzione del server (service_role) scrive; dal portale si
-- legge soltanto, e solo gli Amministratori (regole RLS qui sopra).
grant select, insert, update on notizia, notizie_esecuzione to service_role;
revoke insert, update, delete, truncate on notizia, notizie_esecuzione from anon, authenticated;
grant select on notizia, notizie_esecuzione to authenticated;

-- La funzione del server chiede se può partire e, se sì, registra
-- l'inizio. p_manuale = richiesta di un Amministratore (verificata dalla
-- funzione con il token). Restituisce l'id dell'esecuzione o null se
-- l'ultima è troppo recente (100 minuti pianificata, 10 minuti manuale).
create or replace function notizie_puo_partire(p_manuale boolean, p_utente uuid default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_ultima timestamptz; v_id bigint;
begin
  -- Una richiesta alla volta (le chiamate quasi contemporanee si mettono in fila).
  perform pg_advisory_xact_lock(360036);
  select max(avviata_il) into v_ultima from notizie_esecuzione
   where esito <> 'errore' or avviata_il > now() - interval '10 minutes';
  if v_ultima is not null and v_ultima > now() - (case when p_manuale then interval '10 minutes' else interval '100 minutes' end) then
    return null;
  end if;
  insert into notizie_esecuzione (origine, utente_id)
  values (case when p_manuale then 'manuale' else 'pianificata' end, p_utente)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function notizie_puo_partire(boolean, uuid) from public, anon, authenticated;
grant execute on function notizie_puo_partire(boolean, uuid) to service_role;

-- L'Amministratore nasconde (o rimette) una notizia dall'elenco.
create or replace function notizia_nascondi(p_id bigint, p_nascosta boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Riservato agli amministratori';
  end if;
  update notizia set nascosta = coalesce(p_nascosta, true) where id = p_id;
end $$;
revoke execute on function notizia_nascondi(bigint, boolean) from public, anon;
grant execute on function notizia_nascondi(bigint, boolean) to authenticated;

-- Indirizzo della funzione del server (stesso progetto delle email).
insert into impostazione (chiave, valore)
values ('url_notizie', 'https://ajxrnofgunynkynozmrn.supabase.co/functions/v1/notizie')
on conflict (chiave) do nothing;

-- Chiede una ricerca (asincrona: pg_net). Usata dal lavoro pianificato.
create or replace function richiedi_aggiornamento_notizie()
returns void
language plpgsql security definer set search_path = public as $$
declare v_url text;
begin
  select valore into v_url from impostazione where chiave = 'url_notizie';
  if v_url is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('origine', 'pianificata'),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  );
exception when others then
  raise warning 'Ricerca delle notizie non richiesta: %', sqlerrm;
end $$;
revoke execute on function richiedi_aggiornamento_notizie() from public, anon, authenticated;

-- Ogni 2 ore, al minuto 7 (ora del server, UTC): 00:07, 02:07, …
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cwp_notizie';
    perform cron.schedule('cwp_notizie', '7 */2 * * *', 'select public.richiedi_aggiornamento_notizie()');
    raise notice 'Lavoro pianificato cwp_notizie: ogni 2 ore al minuto 7.';
  else
    raise warning 'pg_cron non è attivo: la ricerca automatica ogni 2 ore non parte (si può usare «Aggiorna ora» nella pagina News).';
  end if;
end $$;

-- Verifica (solo lettura): tabelle e impostazione. Il lavoro pianificato
-- si vede in Supabase → Integrations → Cron (cwp_notizie).
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('notizia', 'notizie_esecuzione')) as tabelle_create,
  (select valore from impostazione where chiave = 'url_notizie') as indirizzo_funzione;
