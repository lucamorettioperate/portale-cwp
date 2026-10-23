-- =====================================================================
--  44 — MARKETING: BANCHE DATI DI COMUNI E GESTORI, CAMPAGNE, RICHIESTE
--
--  Scopo (richiesta di Luca Moretti del 23/10/2026): uno strumento di
--  marketing per gli Amministratori.
--   1. Banca dati di tutti i Comuni italiani, per regione e provincia
--      (ISTAT; PEC, email generica, sito, sindaco e responsabili degli
--      uffici tributi e ambiente da IndicePA, l'Indice dei domicili digitali
--      della Pubblica Amministrazione, open data CC-BY 4.0).
--   2. Banca dati dei gestori: imprese iscritte all'Albo Nazionale Gestori
--      Ambientali in categoria 1 ordinaria (raccolta e trasporto di rifiuti
--      urbani), con la verifica sui loro siti delle attività di raccolta o
--      di gestione della tariffa per i Comuni, PEC, email generica e
--      referenti (direttore tecnico, direttore generale, amministratore).
--   3. Campagne: testo con grafica che invita i Comuni (e i gestori) a
--      contattare la Fondazione, inviate SOLO alle email generiche (mai alle
--      PEC) dei destinatari scelti per ogni campagna; link «Approfondisci»
--      verso la landing page con la micro simulazione; disiscrizione.
--   4. Richieste di registrazione dalla landing page: salvate qui e inviate
--      a tutti gli Amministratori (notifica nel portale ed email, script 09
--      e 12).
--
--  Sicurezza e dati personali:
--   - tutte le tabelle sono SOLO per gli Amministratori (RLS app_is_admin);
--     nessun accesso per Operatori, Comuni e pubblico;
--   - la landing page pubblica e la disiscrizione passano dalla funzione
--     del server «marketing» con la chiave di servizio, che conosce solo il
--     codice casuale (token) del singolo invio;
--   - nomi e recapiti dei referenti vengono da fonti pubbliche (IndicePA,
--     siti istituzionali e aziendali); ogni email di campagna contiene
--     l'informativa (art. 14 GDPR) e il collegamento per non ricevere più
--     comunicazioni (tabella mkt_disiscrizione, rispettata a ogni invio).
--
--  Eseguire DOPO lo script 43, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni. Prove su banco isolato: t44.sql.
--  Registro sviluppo e deploy: capitolo «Database», script 44; capitolo
--  «Marketing».
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enti: Comuni e gestori
-- ---------------------------------------------------------------------
-- Vero se l'indirizzo sembra una PEC dal dominio (es. @pec.…, @pecveneto.it,
-- @legalmail.it, @postacert.…, @cert.…): rete di sicurezza, la fonte
-- principale è il tipo di indirizzo indicato da IndicePA.
create or replace function mkt_sembra_pec(p_email text)
returns boolean
language sql immutable set search_path = public as $$
  select coalesce(lower(p_email) ~ '@(([^@]*[.-])?(pec|cert[.]|legalmail|postacert|arubapec|pecsicura))', false);
$$;

create table if not exists mkt_ente (
  id               bigint generated always as identity primary key,
  tipo             text not null check (tipo in ('comune', 'gestore')),
  -- Chiave stabile per gli aggiornamenti: «istat:028001» per i Comuni,
  -- «albo:MI/012345» per le imprese dell'Albo.
  chiave           text not null unique,
  denominazione    text not null check (length(trim(denominazione)) > 0),
  codice_istat     text,
  codice_ipa       text,
  codice_fiscale   text,
  regione          text,
  provincia        text,
  sigla            text,
  comune_sede      text,
  indirizzo        text,
  cap              text,
  popolazione      int check (popolazione is null or popolazione >= 0),
  pec              text,
  -- Email generica (non PEC): l'unica a cui si inviano le campagne.
  email            text,
  telefono         text,
  sito             text,
  -- Solo gestori: natura (pubblico, privato, misto), iscrizione all'Albo e
  -- attività verificate sul sito (raccolta, gestione della tariffa).
  natura           text check (natura is null or natura in ('pubblico', 'privato', 'misto')),
  albo_numero      text,
  albo_categorie   text,
  attivita_raccolta boolean,
  attivita_tariffa  boolean,
  verificato_il    date,
  fonti            text[] not null default '{}',
  note             text,
  creato_il        timestamptz not null default now(),
  aggiornato_il    timestamptz not null default now(),
  -- L'email generica non deve essere una PEC (le campagne vanno solo alle
  -- email ordinarie).
  constraint mkt_email_non_pec check (email is null or not mkt_sembra_pec(email))
);
create index if not exists idx_mkt_ente_tipo_regione on mkt_ente (tipo, regione, provincia);
create index if not exists idx_mkt_ente_cf on mkt_ente (codice_fiscale);

-- Referenti: sindaco, responsabili tributi e ambiente (Comuni); direttore
-- tecnico, direttore generale, amministratore (gestori).
create table if not exists mkt_referente (
  id          bigint generated always as identity primary key,
  ente_id     bigint not null references mkt_ente(id) on delete cascade,
  ruolo       text not null check (ruolo in ('sindaco', 'tributi', 'ambiente', 'finanziario', 'tecnico',
                                             'direttore_generale', 'direttore_tecnico', 'amministratore', 'altro')),
  -- Chiave della fonte (es. codice dell'unità organizzativa IndicePA) per
  -- aggiornare la stessa riga a ogni importazione.
  chiave      text not null default '',
  nome        text,
  cognome     text,
  ufficio     text,
  email       text,
  telefono    text,
  fonte       text,
  aggiornato_il timestamptz not null default now(),
  unique (ente_id, ruolo, chiave)
);
create index if not exists idx_mkt_referente_ente on mkt_referente (ente_id);

-- ---------------------------------------------------------------------
-- 2. Campagne e invii
-- ---------------------------------------------------------------------
create table if not exists mkt_campagna (
  id            uuid primary key default gen_random_uuid(),
  titolo        text not null check (length(trim(titolo)) between 1 and 200),
  oggetto       text not null check (length(trim(oggetto)) between 1 and 200),
  -- Testo del messaggio (paragrafi separati da una riga vuota).
  testo         text not null default '',
  -- Grafica dell'intestazione (immagine pubblicata in /marketing/).
  grafica       text not null default 'risorse',
  -- Criteri di scelta dei destinatari (solo per memoria: l'elenco vero è
  -- in mkt_invio).
  target        jsonb not null default '{}'::jsonb,
  stato         text not null default 'bozza' check (stato in ('bozza', 'in_invio', 'inviata')),
  creato_da     uuid default auth.uid(),
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  inviata_il    timestamptz
);

create table if not exists mkt_invio (
  id           bigint generated always as identity primary key,
  campagna_id  uuid not null references mkt_campagna(id) on delete cascade,
  ente_id      bigint not null references mkt_ente(id) on delete cascade,
  email        text not null,
  -- Codice casuale del link «Approfondisci» e della disiscrizione.
  token        uuid not null unique default gen_random_uuid(),
  stato        text not null default 'da_inviare' check (stato in ('da_inviare', 'inviato', 'errore', 'escluso')),
  errore       text,
  inviato_il   timestamptz,
  visitato_il  timestamptz,
  simulato_il  timestamptz,
  richiesta_il timestamptz,
  unique (campagna_id, ente_id)
);
create index if not exists idx_mkt_invio_stato on mkt_invio (campagna_id, stato);

-- Indirizzi che non vogliono più ricevere campagne.
create table if not exists mkt_disiscrizione (
  email     text primary key,
  ente_id   bigint references mkt_ente(id) on delete set null,
  creato_il timestamptz not null default now()
);

-- Richieste di registrazione arrivate dalla landing page.
create table if not exists mkt_richiesta (
  id          uuid primary key default gen_random_uuid(),  -- uuid: lo richiede l'audit (audit_registra)
  invio_id    bigint references mkt_invio(id) on delete set null,
  ente_id     bigint references mkt_ente(id) on delete set null,
  ente        text not null check (length(trim(ente)) between 2 and 200),
  referente   text not null check (length(trim(referente)) between 2 and 200),
  ruolo       text,
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono    text,
  messaggio   text check (messaggio is null or length(messaggio) <= 4000),
  simulazione jsonb,
  gestita     boolean not null default false,
  note        text,
  creato_il   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Sicurezza: solo Amministratori
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['mkt_ente', 'mkt_referente', 'mkt_campagna', 'mkt_invio', 'mkt_disiscrizione', 'mkt_richiesta'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format('create policy %I on %I for all using (app_is_admin()) with check (app_is_admin())', t || '_admin', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- Data di modifica dal database.
create or replace function mkt_aggiornato()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.aggiornato_il := now();
  return new;
end $$;
drop trigger if exists trg_mkt_ente_aggiornato on mkt_ente;
create trigger trg_mkt_ente_aggiornato before update on mkt_ente
  for each row execute function mkt_aggiornato();
drop trigger if exists trg_mkt_campagna_aggiornato on mkt_campagna;
create trigger trg_mkt_campagna_aggiornato before update on mkt_campagna
  for each row execute function mkt_aggiornato();

-- Audit delle campagne e delle richieste (le importazioni delle banche
-- dati, migliaia di righe, non vanno nell'audit riga per riga).
drop trigger if exists trg_audit on mkt_campagna;
create trigger trg_audit after insert or update or delete on mkt_campagna
  for each row execute function audit_registra();
drop trigger if exists trg_audit on mkt_richiesta;
create trigger trg_audit after insert or update or delete on mkt_richiesta
  for each row execute function audit_registra();

-- ---------------------------------------------------------------------
-- 4. Funzioni
-- ---------------------------------------------------------------------
-- Prepara gli invii di una campagna in bozza per gli enti scelti: uno per
-- ente con email generica, esclusi gli indirizzi disiscritti e gli enti
-- già presenti nella campagna. Restituisce quanti invii sono stati creati
-- e quanti enti sono stati saltati (senza email o disiscritti).
create or replace function admin_mkt_prepara_invii(p_campagna uuid, p_enti bigint[])
returns table (creati int, saltati int)
language plpgsql security definer set search_path = public as $$
declare v_stato text; v_creati int; v_totale int;
begin
  if not app_is_admin() then raise exception 'Operazione riservata agli amministratori'; end if;
  select stato into v_stato from mkt_campagna where id = p_campagna;
  if v_stato is null then raise exception 'Campagna non trovata'; end if;
  if v_stato = 'inviata' then raise exception 'La campagna è già stata inviata'; end if;
  v_totale := coalesce(array_length(p_enti, 1), 0);
  insert into mkt_invio (campagna_id, ente_id, email)
  select p_campagna, e.id, lower(trim(e.email))
    from mkt_ente e
   where e.id = any (p_enti)
     and e.email is not null and length(trim(e.email)) > 3
     and not exists (select 1 from mkt_disiscrizione d where d.email = lower(trim(e.email)))
  on conflict (campagna_id, ente_id) do nothing;
  get diagnostics v_creati = row_count;
  return query select v_creati, v_totale - v_creati;
end $$;
revoke execute on function admin_mkt_prepara_invii(uuid, bigint[]) from public, anon;
grant execute on function admin_mkt_prepara_invii(uuid, bigint[]) to authenticated;

-- Riepilogo per la pagina Marketing: enti per tipo e regione, con email
-- generica, con PEC e con referenti.
create or replace function admin_mkt_riepilogo()
returns table (tipo text, regione text, enti bigint, con_email bigint, con_pec bigint, con_referenti bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then raise exception 'Operazione riservata agli amministratori'; end if;
  return query
  select e.tipo, coalesce(e.regione, '—'), count(*),
         count(*) filter (where e.email is not null),
         count(*) filter (where e.pec is not null),
         count(*) filter (where exists (select 1 from mkt_referente r where r.ente_id = e.id))
    from mkt_ente e
   group by e.tipo, coalesce(e.regione, '—')
   order by 1, 2;
end $$;
revoke execute on function admin_mkt_riepilogo() from public, anon;
grant execute on function admin_mkt_riepilogo() to authenticated;

-- Verifica rapida: 6 tabelle con RLS.
select count(*) as tabelle_marketing_con_rls
  from pg_class where relname like 'mkt\_%' and relkind = 'r' and relrowsecurity;
