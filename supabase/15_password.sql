-- =====================================================================
--  PASSWORD: CAMBIO OBBLIGATORIO DOPO UNA PASSWORD TEMPORANEA
--  Eseguire DOPO 14_controlli_file.sql. Lo script è rieseguibile.
--
--  - Ogni nuovo utente nasce con una password temporanea (data
--    dall'Amministratore): al primo accesso il portale chiede di sceglierne
--    una nuova e non lascia proseguire finché non è fatto.
--  - Lo stesso vale quando l'Amministratore reimposta la password di un
--    utente (Edge Function "reimposta-password").
--  - Il cambio password e la reimpostazione sono registrati nell'audit.
--  - L'utente non può togliersi da solo l'obbligo: passa solo dalla
--    funzione password_cambiata(), chiamata dopo il cambio effettivo.
-- =====================================================================

alter table profilo add column if not exists password_temporanea boolean not null default true;

-- Gli utenti già esistenti al momento dell'introduzione non sono obbligati.
do $$
begin
  if not exists (select 1 from impostazione where chiave = 'password_temporanea_introdotta') then
    update profilo set password_temporanea = false;
    insert into impostazione (chiave, valore) values ('password_temporanea_introdotta', now()::text);
  end if;
end $$;

-- Protezione del profilo: il flag si cambia solo dalle funzioni previste.
create or replace function profilo_campi_protetti()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Il SQL Editor e le funzioni di servizio (nessun utente autenticato) e
  -- l'amministratore con MFA possono modificare tutto; gli altri solo il
  -- proprio nome.
  if auth.uid() is null or app_is_admin() then
    return new;
  end if;
  if new.ruolo is distinct from old.ruolo
     or new.organizzazione_id is distinct from old.organizzazione_id
     or new.attivo is distinct from old.attivo
     or new.id is distinct from old.id then
    raise exception 'Ruolo, organizzazione e stato del profilo li modifica solo un amministratore';
  end if;
  if new.password_temporanea is distinct from old.password_temporanea
     and coalesce(current_setting('cwp.cambio_password', true), '') <> 'si' then
    raise exception 'Operazione non consentita';
  end if;
  return new;
end $$;

-- Chiamata dal portale subito dopo che l'utente ha cambiato la password.
create or replace function password_cambiata()
returns void
language plpgsql security definer set search_path = public as $$
declare v_era boolean;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  select password_temporanea into v_era from profilo where id = auth.uid();
  perform set_config('cwp.cambio_password', 'si', true);
  update profilo set password_temporanea = false where id = auth.uid();
  insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, oggetto_id, stato_precedente, stato_successivo)
  values (auth.uid(), app_ruolo(), 'cambio password', 'profilo', auth.uid(),
          case when v_era then 'password temporanea' end, 'password personale');
end $$;

revoke all on function password_cambiata() from public, anon;
grant execute on function password_cambiata() to authenticated;
