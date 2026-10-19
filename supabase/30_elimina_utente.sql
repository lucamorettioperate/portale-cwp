-- =====================================================================
--  30 — CANCELLAZIONE DI UN UTENTE MAI ATTIVO
--
--  Scopo: un Amministratore può cancellare un utente che non ha mai
--  operato nel portale, cioè che non compare come autore di nessuna voce
--  dell'audit trail (nessun documento, messaggio, modifica, cambio della
--  password…). Serve, ad esempio, per un account creato per errore o con
--  l'email sbagliata. Chi ha operato si può solo disattivare: la sua
--  storia resta nell'audit.
--
--  Regole (tutte controllate qui, non solo nella pagina):
--   - solo un Amministratore (app_is_admin);
--   - mai sé stessi né l'Amministratore principale (script 29);
--   - nessuna voce di audit con l'utente come autore, e nessun reclamo
--     assegnato all'utente.
--  La cancellazione toglie l'account (auth.users) e, a cascata, profilo,
--  associazioni alle organizzazioni e notifiche. Nell'audit resta la voce
--  «cancellazione profilo» con l'Amministratore che l'ha fatta.
--
--  Eseguire DOPO lo script 29, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 30.
-- =====================================================================


-- Vero se l'utente non ha mai operato (nessuna voce di audit come autore
-- e nessun reclamo assegnato). Uso interno.
create or replace function utente_mai_attivo(p_utente uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from audit_event where utente_id = p_utente)
     and not exists (select 1 from reclamo where gestore_id = p_utente);
$$;
revoke execute on function utente_mai_attivo(uuid) from public, anon, authenticated;

-- Elenco degli utenti cancellabili, per la pagina «Gestione utenti»
-- (mostra il pulsante «Elimina» solo su questi). Solo Amministratori.
create or replace function admin_utenti_eliminabili()
returns setof uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore può vedere questo elenco';
  end if;
  return query
    select p.id from profilo p
     where p.id <> auth.uid()
       and not p.amministratore_principale
       and utente_mai_attivo(p.id);
end $$;
grant execute on function admin_utenti_eliminabili() to authenticated;

-- Cancella l'utente, dopo aver ricontrollato tutte le regole.
create or replace function admin_elimina_utente(p_utente uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore può cancellare un utente';
  end if;
  if p_utente = auth.uid() then
    raise exception 'Non puoi cancellare te stesso';
  end if;
  if not exists (select 1 from profilo where id = p_utente) then
    raise exception 'Utente non trovato';
  end if;
  if exists (select 1 from profilo where id = p_utente and amministratore_principale) then
    raise exception 'L''Amministratore principale non può essere cancellato';
  end if;
  if not utente_mai_attivo(p_utente) then
    raise exception 'L''utente ha già operato nel portale (audit trail): non si può cancellare, si può solo disattivare';
  end if;
  delete from auth.users where id = p_utente;
end $$;
grant execute on function admin_elimina_utente(uuid) to authenticated;
