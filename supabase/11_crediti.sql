-- =====================================================================
--  CALCOLO DEI CREDITI CWP — sezione riservata agli Amministratori
--  (Metodologia Carbon WastePrint® v1.2)
--  Eseguire DOPO 10_mfa_profilo.sql. Lo script è rieseguibile.
--
--  - calcolo_crediti: un calcolo per pratica (Progetto o Rapporto) e anno,
--    ex ante o ex post, con i dati di input (rifiuti, delibera tariffaria,
--    fattori di emissione, opzioni di buffer) e il risultato.
--  - calcolo_conferimento / calcolo_riuso: dati della Banca Dati Utenze
--    (svuotamenti, volumi, pesi, beni a riuso), anche migliaia di righe.
--  - Un calcolo "confermato" non è più modificabile (resta nello storico);
--    per correggerlo se ne crea una nuova versione.
--  - Solo gli Amministratori (con verifica a due fattori) vi accedono.
-- =====================================================================

create table if not exists calcolo_crediti (
  id            uuid primary key default gen_random_uuid(),
  pratica_id    uuid not null references pratica(id) on delete restrict,
  titolo        text not null,
  anno          int not null check (anno between 2000 and 2100),
  tipo          text not null check (tipo in ('ex_ante','ex_post')),
  data_avvio    date,                       -- primo anno parziale (formula 1)
  stato         text not null default 'bozza' check (stato in ('bozza','confermato')),
  dati          jsonb not null default '{}'::jsonb,  -- input (esclusi i conferimenti)
  risultato     jsonb,                      -- riepilogo dell'ultimo calcolo
  delta_i_kg    numeric,                    -- ΔI territorio (kgCO₂eq)
  buffer_pct    numeric,
  crediti_lordi numeric,                    -- tCO₂eq
  crediti_netti numeric,                    -- tCO₂eq
  calcolato_il  timestamptz,
  note          text,
  versione_di   uuid references calcolo_crediti(id) on delete set null,
  creato_da     uuid references auth.users(id) on delete set null default auth.uid(),
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  confermato_da uuid references auth.users(id) on delete set null,
  confermato_il timestamptz
);
create index if not exists idx_calcolo_pratica on calcolo_crediti (pratica_id, anno);

create table if not exists calcolo_conferimento (
  id               bigint generated always as identity primary key,
  calcolo_id       uuid not null references calcolo_crediti(id) on delete cascade,
  utenza           text not null,
  macro            text not null check (macro in ('UD','UnD')),
  classe           text not null,
  tipologia        text not null,
  svuotamenti      numeric,   -- S(r,i) n/anno
  volume           numeric,   -- VC(r,i) litri per svuotamento
  peso_strutture   numeric,   -- PStIn kg/anno
  volume_strutture numeric,   -- VStIn litri/anno
  peso_cdr         numeric,   -- PCdR kg/anno
  volume_cdr       numeric,   -- VCdR litri/anno
  n_utenze         numeric not null default 1  -- >1 per valori medi di classe (ex ante)
);
create index if not exists idx_conferimento_calcolo on calcolo_conferimento (calcolo_id);

create table if not exists calcolo_riuso (
  id          bigint generated always as identity primary key,
  calcolo_id  uuid not null references calcolo_crediti(id) on delete cascade,
  utenza      text not null,
  macro       text not null check (macro in ('UD','UnD')),
  classe      text not null,
  bene        text not null,
  pezzi       numeric,
  peso        numeric,   -- kg, se pesato direttamente
  n_utenze    numeric not null default 1
);
create index if not exists idx_riuso_calcolo on calcolo_riuso (calcolo_id);

-- Sicurezza: solo Amministratori con MFA.
alter table calcolo_crediti enable row level security;
alter table calcolo_conferimento enable row level security;
alter table calcolo_riuso enable row level security;

drop policy if exists calcolo_admin on calcolo_crediti;
create policy calcolo_admin on calcolo_crediti for all
  using (app_is_admin()) with check (app_is_admin());
drop policy if exists conferimento_admin on calcolo_conferimento;
create policy conferimento_admin on calcolo_conferimento for all
  using (app_is_admin()) with check (app_is_admin());
drop policy if exists riuso_admin on calcolo_riuso;
create policy riuso_admin on calcolo_riuso for all
  using (app_is_admin()) with check (app_is_admin());

-- Un calcolo confermato è immutabile; nemmeno i suoi dati si toccano.
create or replace function calcolo_immutabile()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_stato text; v_id uuid;
begin
  if tg_table_name = 'calcolo_crediti' then
    if tg_op = 'DELETE' then
      if old.stato = 'confermato' then
        raise exception 'Un calcolo confermato non si cancella';
      end if;
      return old;
    end if;
    if old.stato = 'confermato' then
      raise exception 'Un calcolo confermato non si modifica: creane una nuova versione';
    end if;
    if new.stato = 'confermato' then
      if new.risultato is null then
        raise exception 'Esegui il calcolo prima di confermarlo';
      end if;
      new.confermato_da := auth.uid();
      new.confermato_il := now();
    end if;
    new.aggiornato_il := now();
    return new;
  end if;
  -- Righe di dettaglio: il calcolo deve essere in bozza.
  v_id := case when tg_op = 'DELETE' then old.calcolo_id else new.calcolo_id end;
  select stato into v_stato from calcolo_crediti where id = v_id;
  if v_stato = 'confermato' then
    raise exception 'I dati di un calcolo confermato non si modificano';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists trg_calcolo_immutabile on calcolo_crediti;
create trigger trg_calcolo_immutabile before update or delete on calcolo_crediti
  for each row execute function calcolo_immutabile();
drop trigger if exists trg_conferimento_immutabile on calcolo_conferimento;
create trigger trg_conferimento_immutabile before insert or update or delete on calcolo_conferimento
  for each row execute function calcolo_immutabile();
drop trigger if exists trg_riuso_immutabile on calcolo_riuso;
create trigger trg_riuso_immutabile before insert or update or delete on calcolo_riuso
  for each row execute function calcolo_immutabile();

-- Audit: creazione, ricalcolo, conferma, cancellazione di un calcolo
-- (le singole righe dei conferimenti non si registrano una per una).
drop trigger if exists trg_audit on calcolo_crediti;
create trigger trg_audit after insert or update or delete on calcolo_crediti
  for each row execute function audit_registra();
