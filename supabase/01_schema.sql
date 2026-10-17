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
