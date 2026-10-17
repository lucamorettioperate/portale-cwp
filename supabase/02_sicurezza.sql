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
