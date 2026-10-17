-- =====================================================================
--  MFA OBBLIGATORIA PER LO STAFF E PROTEZIONE DEL PROFILO (requisiti §13)
--  Eseguire DOPO 09_cruscotto_pagamenti_notifiche.sql.
--  Lo script è rieseguibile.
--
--  1. CORREZIONE DI SICUREZZA: un utente poteva modificare il proprio
--     profilo, compresi ruolo e organizzazione (autopromozione ad admin o
--     accesso ai dati di un altro comune). Ora può cambiare solo il nome.
--  2. Un profilo disattivato non ha più alcun ruolo (nessun accesso ai dati).
--  3. Operatori e Amministratori hanno i poteri del back-office solo dopo
--     la verifica a due fattori (sessione "aal2").
--  4. Interruttore di emergenza: se un amministratore perde l'accesso
--     all'app di autenticazione, dal SQL Editor di Supabase si esegue
--        update impostazione set valore = 'false' where chiave = 'mfa_obbligatoria';
--     e lo si riattiva con 'true' appena risolto.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Impostazioni della piattaforma (modificabili solo dal SQL Editor)
-- ---------------------------------------------------------------------
create table if not exists impostazione (
  chiave text primary key,
  valore text not null,
  aggiornato_il timestamptz not null default now()
);
alter table impostazione enable row level security;
-- Nessuna policy: dal portale non si legge né si scrive.

insert into impostazione (chiave, valore) values ('mfa_obbligatoria', 'true')
on conflict (chiave) do nothing;


-- ---------------------------------------------------------------------
-- Funzioni di ruolo
-- ---------------------------------------------------------------------
-- La sessione corrente ha superato la verifica a due fattori?
create or replace function app_mfa_ok()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select valore from impostazione where chiave = 'mfa_obbligatoria'), 'true') <> 'true'
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- Ruolo dell'utente corrente; nessun ruolo se il profilo è disattivato.
create or replace function app_ruolo()
returns ruolo_utente
language sql stable security definer set search_path = public as $$
  select ruolo from profilo where id = auth.uid() and attivo;
$$;

-- Organizzazione principale; nessuna se il profilo è disattivato.
create or replace function app_organizzazione()
returns uuid
language sql stable security definer set search_path = public as $$
  select organizzazione_id from profilo where id = auth.uid() and attivo;
$$;

-- Staff (operatore/admin) con verifica a due fattori.
create or replace function app_is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_ruolo() in ('operatore','admin'), false) and app_mfa_ok();
$$;

-- Amministratore con verifica a due fattori.
create or replace function app_is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_ruolo() = 'admin', false) and app_mfa_ok();
$$;

-- Le associazioni multi-organizzazione valgono solo per profili attivi.
create or replace function app_org_mia(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null and exists (select 1 from profilo where id = auth.uid() and attivo) and (
    p_org = app_organizzazione()
    or exists (
      select 1 from utente_organizzazione uo
      where uo.utente_id = auth.uid()
        and uo.organizzazione_id = p_org
    )
  );
$$;

-- Stato della propria sessione, per il portale (serve a sapere se chiedere
-- il codice dell'app di autenticazione).
create or replace function mio_stato_mfa()
returns table (richiesta boolean, verificata boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(app_ruolo() in ('operatore','admin'), false)
           and coalesce((select valore from impostazione where chiave = 'mfa_obbligatoria'), 'true') = 'true',
         coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
grant execute on function mio_stato_mfa() to authenticated;


-- ---------------------------------------------------------------------
-- PROFILO: ciascuno modifica solo il proprio nome
-- ---------------------------------------------------------------------
drop policy if exists profilo_self_update on profilo;
create policy profilo_self_update on profilo for update
  using (id = auth.uid() or app_is_admin())
  with check (id = auth.uid() or app_is_admin());

create or replace function profilo_campi_protetti()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Il SQL Editor (nessun utente autenticato) e l'amministratore con MFA
  -- possono modificare tutto; gli altri solo il proprio nome.
  if auth.uid() is null or app_is_admin() then
    return new;
  end if;
  if new.ruolo is distinct from old.ruolo
     or new.organizzazione_id is distinct from old.organizzazione_id
     or new.attivo is distinct from old.attivo
     or new.id is distinct from old.id then
    raise exception 'Ruolo, organizzazione e stato del profilo li modifica solo un amministratore';
  end if;
  return new;
end $$;

drop trigger if exists trg_profilo_campi_protetti on profilo;
create trigger trg_profilo_campi_protetti
  before update on profilo
  for each row execute function profilo_campi_protetti();


-- ---------------------------------------------------------------------
-- Funzioni di amministrazione: richiedono admin con MFA
-- ---------------------------------------------------------------------
create or replace function admin_aggiorna_utente(
  p_utente uuid,
  p_ruolo ruolo_utente,
  p_organizzazione uuid
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore (con verifica a due fattori) può modificare gli utenti';
  end if;
  if p_ruolo = 'admin' then
    raise exception 'La nomina di amministratori non è consentita da qui';
  end if;
  update profilo
    set ruolo = p_ruolo,
        organizzazione_id = case when p_ruolo = 'cliente' then p_organizzazione else null end
  where id = p_utente;
end $$;

create or replace function admin_imposta_organizzazioni(
  p_utente uuid,
  p_organizzazioni uuid[]
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_lista uuid[] := coalesce(p_organizzazioni, '{}');
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore (con verifica a due fattori) può modificare le associazioni';
  end if;
  delete from utente_organizzazione
   where utente_id = p_utente
     and not (organizzazione_id = any (v_lista));
  insert into utente_organizzazione (utente_id, organizzazione_id)
  select p_utente, o from unnest(v_lista) o
  on conflict do nothing;
  update profilo
     set organizzazione_id = v_lista[1]
   where id = p_utente
     and organizzazione_id is distinct from v_lista[1];
end $$;

-- Attiva / disattiva un utente (solo admin): un utente disattivato non
-- vede più alcun dato.
create or replace function admin_imposta_attivo(p_utente uuid, p_attivo boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore (con verifica a due fattori) può disattivare un utente';
  end if;
  if p_utente = auth.uid() and not p_attivo then
    raise exception 'Non puoi disattivare te stesso';
  end if;
  update profilo set attivo = p_attivo where id = p_utente;
end $$;
grant execute on function admin_imposta_attivo(uuid, boolean) to authenticated;

-- Per la Edge Function "crea-utente": il chiamante è admin con MFA?
create or replace function sono_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select app_is_admin();
$$;
grant execute on function sono_admin() to authenticated;
