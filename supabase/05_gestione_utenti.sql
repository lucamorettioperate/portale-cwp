-- =====================================================================
--  GESTIONE UTENTI (Admin)
--  - funzione per elencare gli utenti con email, ruolo, organizzazione
--    (solo per admin)
--  - funzione per aggiornare ruolo e organizzazione di un utente
--    (solo admin; non consente di creare nuovi admin dal portale)
--  Eseguire DOPO 02_sicurezza.sql, nel SQL Editor di Supabase.
-- =====================================================================

-- Elenco utenti: unisce profilo + email (da auth.users) + organizzazione.
-- SECURITY DEFINER per leggere auth.users, ma con controllo di ruolo interno.
create or replace function admin_elenco_utenti()
returns table (
  id uuid,
  email text,
  ruolo ruolo_utente,
  nome_completo text,
  organizzazione_id uuid,
  organizzazione text,
  attivo boolean,
  creato_il timestamptz
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not app_is_staff() then
    raise exception 'Accesso non consentito';
  end if;
  return query
    select p.id, u.email::text, p.ruolo, p.nome_completo,
           p.organizzazione_id, o.denominazione, p.attivo, p.creato_il
    from profilo p
    join auth.users u on u.id = p.id
    left join organizzazione o on o.id = p.organizzazione_id
    order by p.creato_il desc;
end $$;

-- Aggiorna ruolo e organizzazione di un utente.
-- Solo admin. Non permette di assegnare il ruolo 'admin' (prudenza):
-- la nomina di nuovi admin resta un'operazione separata e controllata.
create or replace function admin_aggiorna_utente(
  p_utente uuid,
  p_ruolo ruolo_utente,
  p_organizzazione uuid
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if app_ruolo() <> 'admin' then
    raise exception 'Solo un amministratore può modificare gli utenti';
  end if;
  if p_ruolo = 'admin' then
    raise exception 'La nomina di amministratori non è consentita da qui';
  end if;
  update profilo
    set ruolo = p_ruolo,
        organizzazione_id = case when p_ruolo = 'cliente' then p_organizzazione else null end
  where id = p_utente;
end $$;

-- Permessi di esecuzione agli utenti autenticati
-- (il controllo di ruolo è dentro le funzioni).
grant execute on function admin_elenco_utenti() to authenticated;
grant execute on function admin_aggiorna_utente(uuid, ruolo_utente, uuid) to authenticated;
