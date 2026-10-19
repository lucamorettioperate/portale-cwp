-- =====================================================================
--  28_simulatore.sql — SIMULATORE DI SCENARI (19/10/2026)
--
--  Scopo: salva gli scenari del simulatore dei crediti (Registro,
--  backlog punto 37). Uno scenario è una stima ex ante, non certificabile,
--  di quanti crediti un Comune potrebbe generare in 7, 10 o 21 anni
--  (Standard 4.3.8), a partire dai dati dell'anno base e dagli obiettivi
--  annui di produzione dei rifiuti e di secco residuo.
--
--  Il calcolo si fa nel browser (src/lib/crediti/simulatore.js): qui si
--  conservano gli input (colonna dati) e il riepilogo dei risultati.
--
--  Sicurezza: leggono e scrivono solo gli utenti dello staff (Operatori e
--  Amministratori), con la stessa regola delle altre tabelle dello staff
--  (app_is_staff, script 10). Il Comune non vede gli scenari (scelta
--  provvisoria, da confermare: Registro, decisioni aperte).
--  Ogni creazione, modifica e cancellazione finisce nell'audit
--  (audit_registra, script 21).
--
--  Rieseguibile. Usato da: src/lib/crediti/scenari.js,
--  src/pages/Simulatore.jsx.
--  Registro sviluppo e deploy: capitolo 15 «Calcolo crediti».
-- =====================================================================

create table if not exists scenario_simulazione (
  id                   uuid primary key default gen_random_uuid(),
  -- Comune già censito nel portale (facoltativo: si possono simulare anche
  -- Comuni non ancora aderenti, indicati solo con il nome).
  organizzazione_id    uuid references organizzazione(id) on delete set null,
  comune               text not null check (length(trim(comune)) between 1 and 200),
  nome                 text not null check (length(trim(nome)) between 1 and 120),
  note                 text check (note is null or length(note) <= 4000),
  -- Durata del periodo di accreditamento: 7, 10 o 21 anni (Standard 4.3.8).
  durata               int not null default 10 check (durata in (7, 10, 21)),
  anno_inizio          int not null check (anno_inizio between 2000 and 2100),
  -- Input dello scenario: anno base, fattori, buffer, obiettivi anno per anno.
  dati                 jsonb not null default '{}'::jsonb,
  -- Riepilogo dell'ultima simulazione (totali del periodo), per l'elenco.
  crediti_netti_totali numeric,
  rd_finale            numeric,
  simulato_il          timestamptz,
  creato_da            uuid references auth.users(id) on delete set null default auth.uid(),
  creato_il            timestamptz not null default now(),
  aggiornato_il        timestamptz not null default now()
);
create index if not exists idx_scenario_comune on scenario_simulazione (comune, aggiornato_il desc);
create index if not exists idx_scenario_org on scenario_simulazione (organizzazione_id);

alter table scenario_simulazione enable row level security;

drop policy if exists scenario_staff on scenario_simulazione;
create policy scenario_staff on scenario_simulazione for all
  using (app_is_staff()) with check (app_is_staff());

-- Data di ultima modifica aggiornata dal database (non dal browser).
create or replace function scenario_aggiornato()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.aggiornato_il := now();
  return new;
end $$;

drop trigger if exists trg_scenario_aggiornato on scenario_simulazione;
create trigger trg_scenario_aggiornato before update on scenario_simulazione
  for each row execute function scenario_aggiornato();

-- Audit: creazione, modifica e cancellazione di uno scenario.
drop trigger if exists trg_audit on scenario_simulazione;
create trigger trg_audit after insert or update or delete on scenario_simulazione
  for each row execute function audit_registra();

-- Verifica rapida dopo l'esecuzione (deve restituire 1 riga, rls = true).
select relname as tabella, relrowsecurity as rls
  from pg_class where relname = 'scenario_simulazione';
