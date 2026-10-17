-- =====================================================================
--  PORTALE CARBON WASTEPRINT — Schema del database (Supabase / PostgreSQL)
--  Allineato all'analisi funzionale "Requisiti della piattaforma" (15/09/2026).
--
--  Da eseguire nel SQL Editor di Supabase, una sola volta, tutto insieme.
--  Idempotente dove possibile (IF NOT EXISTS). Crea tabelle, tipi, indici,
--  trigger di audit e le policy di sicurezza (RLS) sui tre ruoli.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Estensioni
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. Tipi enumerati (stati e categorie dal documento)
-- ---------------------------------------------------------------------
do $$ begin
  create type ruolo_utente as enum ('cliente', 'operatore', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_pratica as enum ('progetto', 'rapporto');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Stati di pratica (Progetto o Rapporto)
  create type stato_pratica as enum ('attiva', 'sospesa', 'annullata', 'chiusa');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Stati di fase, comuni a tutte le fasi
  create type stato_fase as enum ('non_iniziata', 'in_corso', 'in_attesa_integrazione', 'completata');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Stati del commento in consultazione pubblica
  create type stato_commento as enum ('ricevuto', 'pubblicato', 'non_pubblicato', 'risposto');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Visibilità documento: tre flag indipendenti gestiti come colonne booleane,
  -- ma teniamo anche uno stato di lavorazione del documento.
  create type stato_documento as enum ('bozza', 'corrente', 'pubblicato', 'archiviato');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Anagrafiche
-- ---------------------------------------------------------------------

-- Organizzazione: comune, ente o azienda cliente.
create table if not exists organizzazione (
  id            uuid primary key default gen_random_uuid(),
  denominazione text not null,
  tipo          text,                       -- es. "Ente locale (T.U.E.L.)", "Soggetto gestore"
  codice_fiscale text,
  partita_iva   text,
  pec           text,
  note          text,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Profilo utente applicativo, collegato all'utente di autenticazione Supabase.
-- Un'utenza Cliente appartiene a una Organizzazione; Operatori/Admin no.
create table if not exists profilo (
  id              uuid primary key references auth.users(id) on delete cascade,
  ruolo           ruolo_utente not null default 'cliente',
  nome_completo   text,
  organizzazione_id uuid references organizzazione(id) on delete set null,
  attivo          boolean not null default true,
  creato_il       timestamptz not null default now()
);

-- Ente di Validazione: anagrafica, NON è un utente (non accede alla piattaforma).
create table if not exists ente_validazione (
  id            uuid primary key default gen_random_uuid(),
  denominazione text not null,
  identificativo text,
  accreditamento text,                      -- eventuale stato di accreditamento
  note          text,
  creato_il     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Pratiche: Progetto e Rapporto di Monitoraggio
--    Un Progetto appartiene a una Organizzazione.
--    Un Progetto può avere fino a 10 Rapporti annuali (pratiche autonome).
-- ---------------------------------------------------------------------
create table if not exists pratica (
  id                uuid primary key default gen_random_uuid(),
  codice            text unique,            -- es. "CWP-2026-0023"
  tipo              tipo_pratica not null,
  organizzazione_id uuid not null references organizzazione(id) on delete restrict,

  -- Per i Rapporti: collegamento al Progetto padre e anno di riferimento.
  progetto_padre_id uuid references pratica(id) on delete restrict,
  anno_monitoraggio int,                    -- valorizzato solo per i Rapporti (1..10)

  titolo            text,
  stato             stato_pratica not null default 'attiva',
  ente_validazione_id uuid references ente_validazione(id) on delete set null,

  motivazione_stato text,                   -- obbligatoria per sospesa/annullata (vincolo sotto)
  creato_il         timestamptz not null default now(),
  aggiornato_il     timestamptz not null default now(),

  -- Un Rapporto deve avere un progetto padre e un anno; un Progetto no.
  constraint chk_rapporto_padre check (
    (tipo = 'rapporto' and progetto_padre_id is not null and anno_monitoraggio is not null)
    or (tipo = 'progetto' and progetto_padre_id is null)
  ),
  constraint chk_anno_range check (
    anno_monitoraggio is null or (anno_monitoraggio between 1 and 10)
  ),
  -- Stati sospesa/annullata richiedono motivazione.
  constraint chk_motivazione check (
    stato not in ('sospesa','annullata') or (motivazione_stato is not null and length(trim(motivazione_stato)) > 0)
  )
);

-- Al più 10 Rapporti per Progetto e un solo Rapporto per anno.
create unique index if not exists uq_rapporto_anno
  on pratica (progetto_padre_id, anno_monitoraggio)
  where tipo = 'rapporto';

create index if not exists idx_pratica_org on pratica (organizzazione_id);
create index if not exists idx_pratica_padre on pratica (progetto_padre_id);

-- ---------------------------------------------------------------------
-- 4. Fasi del workflow (7 fasi per pratica)
-- ---------------------------------------------------------------------
create table if not exists fase (
  id              uuid primary key default gen_random_uuid(),
  pratica_id      uuid not null references pratica(id) on delete cascade,
  numero          int not null,             -- 1..7
  nome            text not null,
  stato           stato_fase not null default 'non_iniziata',
  responsabile    text,                     -- soggetto responsabile (testo descrittivo)
  data_apertura         date,
  data_prevista_chiusura date,
  data_effettiva_chiusura date,
  note            text,
  creato_il       timestamptz not null default now(),
  aggiornato_il   timestamptz not null default now(),
  unique (pratica_id, numero)
);

create index if not exists idx_fase_pratica on fase (pratica_id);

-- ---------------------------------------------------------------------
-- 5. Documenti (versionati, mai sovrascritti) + richieste di integrazione
-- ---------------------------------------------------------------------
create table if not exists documento (
  id              uuid primary key default gen_random_uuid(),
  pratica_id      uuid not null references pratica(id) on delete cascade,
  fase_id         uuid references fase(id) on delete set null,
  tipologia       text,
  nome            text not null,
  versione        int not null default 1,
  corrente        boolean not null default true,    -- la versione attualmente valida
  -- Visibilità: tre flag indipendenti, DEFAULT non pubblico.
  visibile_cliente    boolean not null default true,
  visibile_fondazione boolean not null default true,
  pubblico            boolean not null default false,
  stato           stato_documento not null default 'corrente',
  storage_path    text,                     -- percorso nel bucket di Supabase Storage
  hash_file       text,                     -- hash del file (integrità)
  caricato_da     uuid references auth.users(id) on delete set null,
  creato_il       timestamptz not null default now()
);

create index if not exists idx_doc_pratica on documento (pratica_id);
create index if not exists idx_doc_fase on documento (fase_id);

-- Richiesta di integrazione durante una fase aperta.
create table if not exists richiesta_integrazione (
  id            uuid primary key default gen_random_uuid(),
  fase_id       uuid not null references fase(id) on delete cascade,
  pratica_id    uuid not null references pratica(id) on delete cascade,
  descrizione   text not null,
  richiesta_da  uuid references auth.users(id) on delete set null,
  risolta       boolean not null default false,
  documento_risposta_id uuid references documento(id) on delete set null,
  creato_il     timestamptz not null default now()
);

create index if not exists idx_integr_fase on richiesta_integrazione (fase_id);

-- ---------------------------------------------------------------------
-- 6. Consultazione pubblica e commenti
-- ---------------------------------------------------------------------
create table if not exists consultazione (
  id              uuid primary key default gen_random_uuid(),
  pratica_id      uuid not null references pratica(id) on delete cascade,
  documento_id    uuid references documento(id) on delete set null,  -- versione pubblicata e bloccata
  data_apertura   date,
  data_chiusura   date,                     -- apertura + 30 giorni
  attiva          boolean not null default true,
  creato_il       timestamptz not null default now()
);

create table if not exists commento (
  id              uuid primary key default gen_random_uuid(),
  consultazione_id uuid not null references consultazione(id) on delete cascade,
  pratica_id      uuid not null references pratica(id) on delete cascade,
  testo           text not null,
  allegato_documento_id uuid references documento(id) on delete set null,
  -- Identità nota alla piattaforma, ma il commento è pubblicato in forma anonima.
  autore_utente_id uuid references auth.users(id) on delete set null,
  stato           stato_commento not null default 'ricevuto',
  motivazione_moderazione text,
  risposta_testo  text,                     -- risposta del Cliente
  creato_il       timestamptz not null default now()
);

create index if not exists idx_commento_consultazione on commento (consultazione_id);

-- ---------------------------------------------------------------------
-- 7. Pagamenti (registrazione manuale, nessun incasso online)
-- ---------------------------------------------------------------------
create table if not exists pagamento (
  id            uuid primary key default gen_random_uuid(),
  pratica_id    uuid not null references pratica(id) on delete cascade,
  descrizione   text,                       -- voce / piano
  importo       numeric(12,2),
  scadenza      date,
  pagato        boolean not null default false,
  data_pagamento date,
  riferimento   text,
  registrato_da uuid references auth.users(id) on delete set null,
  creato_il     timestamptz not null default now()
);

create index if not exists idx_pagamento_pratica on pagamento (pratica_id);

-- ---------------------------------------------------------------------
-- 8. Audit trail (append-only): ogni operazione rilevante
-- ---------------------------------------------------------------------
create table if not exists audit_event (
  id            bigint generated always as identity primary key,
  avvenuto_il   timestamptz not null default now(),
  utente_id     uuid references auth.users(id) on delete set null,
  ruolo         ruolo_utente,
  operazione    text not null,              -- es. "chiusura fase"
  oggetto_tipo  text,                       -- es. "pratica", "documento"
  oggetto_id    uuid,
  stato_precedente text,
  stato_successivo text,
  motivazione   text,
  dettaglio     jsonb
);

create index if not exists idx_audit_oggetto on audit_event (oggetto_tipo, oggetto_id);

comment on table audit_event is 'Append-only: non modificabile né cancellabile dal back-office.';
-- =====================================================================
--  PORTALE CARBON WASTEPRINT — Sicurezza (RLS) e automatismi
--  Da eseguire DOPO 01_schema.sql, nel SQL Editor di Supabase.
--
--  Principi (dall'analisi funzionale):
--  - RBAC su tre ruoli: cliente, operatore, admin.
--  - Un'Organizzazione non può accedere ai dati di un'altra.
--  - Operatori e Admin vedono tutto il back-office.
--  - L'audit è append-only: nessuno lo modifica o cancella.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Funzioni di supporto: ruolo e organizzazione dell'utente corrente
-- ---------------------------------------------------------------------
create or replace function app_ruolo()
returns ruolo_utente
language sql stable security definer set search_path = public as $$
  select ruolo from profilo where id = auth.uid();
$$;

create or replace function app_organizzazione()
returns uuid
language sql stable security definer set search_path = public as $$
  select organizzazione_id from profilo where id = auth.uid();
$$;

-- Comodità: è staff (operatore o admin)?
create or replace function app_is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_ruolo() in ('operatore','admin'), false);
$$;

-- ---------------------------------------------------------------------
-- 2. Creazione automatica del profilo alla registrazione di un utente
--    (ruolo di default: cliente)
-- ---------------------------------------------------------------------
create or replace function on_auth_user_created()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profilo (id, ruolo, nome_completo)
  values (new.id, 'cliente', coalesce(new.raw_user_meta_data->>'nome_completo', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function on_auth_user_created();

-- ---------------------------------------------------------------------
-- 3. Abilita RLS su tutte le tabelle applicative
-- ---------------------------------------------------------------------
alter table organizzazione        enable row level security;
alter table profilo               enable row level security;
alter table ente_validazione      enable row level security;
alter table pratica               enable row level security;
alter table fase                  enable row level security;
alter table documento             enable row level security;
alter table richiesta_integrazione enable row level security;
alter table consultazione         enable row level security;
alter table commento              enable row level security;
alter table pagamento             enable row level security;
alter table audit_event           enable row level security;

-- ---------------------------------------------------------------------
-- 4. Policy
--    Nota: lo staff (operatore/admin) ha accesso pieno; il cliente solo
--    ai dati della propria organizzazione.
-- ---------------------------------------------------------------------

-- PROFILO: ciascuno vede e aggiorna il proprio; lo staff vede tutti.
drop policy if exists profilo_self_select on profilo;
create policy profilo_self_select on profilo for select
  using (id = auth.uid() or app_is_staff());

drop policy if exists profilo_self_update on profilo;
create policy profilo_self_update on profilo for update
  using (id = auth.uid() or app_ruolo() = 'admin');

-- ORGANIZZAZIONE: staff tutto; cliente solo la propria.
drop policy if exists org_select on organizzazione;
create policy org_select on organizzazione for select
  using (app_is_staff() or id = app_organizzazione());

drop policy if exists org_write on organizzazione;
create policy org_write on organizzazione for all
  using (app_is_staff()) with check (app_is_staff());

-- ENTE DI VALIDAZIONE: gestito dallo staff; cliente in sola lettura.
drop policy if exists ente_select on ente_validazione;
create policy ente_select on ente_validazione for select
  using (true);
drop policy if exists ente_write on ente_validazione;
create policy ente_write on ente_validazione for all
  using (app_is_staff()) with check (app_is_staff());

-- PRATICA: staff tutto; cliente solo quelle della propria organizzazione.
drop policy if exists pratica_select on pratica;
create policy pratica_select on pratica for select
  using (app_is_staff() or organizzazione_id = app_organizzazione());
drop policy if exists pratica_write on pratica;
create policy pratica_write on pratica for all
  using (app_is_staff()) with check (app_is_staff());

-- Helper: la pratica è della mia organizzazione?
create or replace function pratica_mia(p_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pratica
    where id = p_id and (app_is_staff() or organizzazione_id = app_organizzazione())
  );
$$;

-- FASE
drop policy if exists fase_select on fase;
create policy fase_select on fase for select using (pratica_mia(pratica_id));
drop policy if exists fase_write on fase;
create policy fase_write on fase for all
  using (app_is_staff()) with check (app_is_staff());

-- DOCUMENTO: il cliente vede i documenti della propria pratica marcati
-- visibili_cliente o pubblici; lo staff vede tutto.
drop policy if exists doc_select on documento;
create policy doc_select on documento for select
  using (
    app_is_staff()
    or (pratica_mia(pratica_id) and (visibile_cliente or pubblico))
  );
drop policy if exists doc_insert on documento;
create policy doc_insert on documento for insert
  with check (app_is_staff() or pratica_mia(pratica_id));
drop policy if exists doc_update on documento;
create policy doc_update on documento for update using (app_is_staff());

-- RICHIESTA INTEGRAZIONE
drop policy if exists integr_select on richiesta_integrazione;
create policy integr_select on richiesta_integrazione for select using (pratica_mia(pratica_id));
drop policy if exists integr_write on richiesta_integrazione;
create policy integr_write on richiesta_integrazione for all
  using (app_is_staff()) with check (app_is_staff());

-- CONSULTAZIONE
drop policy if exists consult_select on consultazione;
create policy consult_select on consultazione for select using (pratica_mia(pratica_id) or app_is_staff());
drop policy if exists consult_write on consultazione;
create policy consult_write on consultazione for all
  using (app_is_staff()) with check (app_is_staff());

-- COMMENTO: lo staff gestisce tutto; il cliente della pratica vede i commenti,
-- un autenticato può inserire un commento sulla consultazione.
drop policy if exists commento_select on commento;
create policy commento_select on commento for select using (pratica_mia(pratica_id) or app_is_staff());
drop policy if exists commento_insert on commento;
create policy commento_insert on commento for insert with check (auth.uid() is not null);
drop policy if exists commento_update on commento;
create policy commento_update on commento for update using (app_is_staff());

-- PAGAMENTO: solo staff.
drop policy if exists pagamento_all on pagamento;
create policy pagamento_all on pagamento for all
  using (app_is_staff()) with check (app_is_staff());

-- AUDIT: consultabile (staff tutto; cliente limitato alle proprie pratiche).
-- Append-only: nessun update/delete (nessuna policy che li consenta).
drop policy if exists audit_select on audit_event;
create policy audit_select on audit_event for select
  using (
    app_ruolo() = 'admin'
    or (app_is_staff())
    or (oggetto_tipo = 'pratica' and pratica_mia(oggetto_id))
  );
drop policy if exists audit_insert on audit_event;
create policy audit_insert on audit_event for insert with check (auth.uid() is not null);
-- Nessuna policy di UPDATE/DELETE su audit_event: resta immutabile via RLS.
