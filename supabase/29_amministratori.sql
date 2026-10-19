-- =====================================================================
--  29 — PIÙ AMMINISTRATORI E AMMINISTRATORE PRINCIPALE PROTETTO
--
--  Scopo:
--   1. Gli Amministratori possono nominare altri Amministratori dalla
--      pagina «Gestione utenti» (prima la nomina si faceva solo da
--      Supabase). Un Amministratore ha accesso completo a tutti i dati,
--      come quello principale.
--   2. L'Amministratore principale (luca.moretti@operate.it) non può
--      essere cancellato, disattivato o declassato da nessuno dal
--      portale. Nemmeno dal pannello di Supabase si può cancellare il
--      suo account: prima bisogna togliere la protezione dal SQL Editor
--      (vedi in fondo).
--   3. Gli altri Amministratori si possono declassare o disattivare da
--      un Amministratore, mai da sé stessi.
--
--  Eseguire DOPO lo script 28, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 29.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. IL SEGNO «AMMINISTRATORE PRINCIPALE» SUL PROFILO
-- ---------------------------------------------------------------------
-- Vero solo per un profilo (indice unico parziale).
alter table profilo add column if not exists amministratore_principale boolean not null default false;
create unique index if not exists profilo_un_solo_principale
  on profilo (amministratore_principale) where amministratore_principale;

-- Assegna il segno all'account luca.moretti@operate.it e si assicura che
-- sia amministratore e attivo. Se l'account non esiste ancora non fa nulla.
update profilo p
   set amministratore_principale = true, ruolo = 'admin', attivo = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'luca.moretti@operate.it'
   and not exists (select 1 from profilo x where x.amministratore_principale and x.id <> p.id);


-- ---------------------------------------------------------------------
-- 2. PROTEZIONE DEL PROFILO PRINCIPALE
-- ---------------------------------------------------------------------
-- Dal portale (utente autenticato) nessuno può:
--  - cambiare ruolo o stato dell'Amministratore principale;
--  - cancellarne il profilo;
--  - dare o togliere il segno «principale» a qualcuno.
-- Dal SQL Editor (nessun utente autenticato) resta tutto possibile.
create or replace function profilo_principale_protetto()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.amministratore_principale then
      raise exception 'L''Amministratore principale non può essere cancellato';
    end if;
    return old;
  end if;
  if new.amministratore_principale is distinct from old.amministratore_principale then
    raise exception 'L''Amministratore principale si cambia solo dal SQL Editor di Supabase';
  end if;
  if old.amministratore_principale
     and (new.ruolo is distinct from old.ruolo or new.attivo is distinct from old.attivo) then
    raise exception 'L''Amministratore principale non può essere declassato né disattivato';
  end if;
  return new;
end $$;

drop trigger if exists trg_profilo_principale on profilo;
create trigger trg_profilo_principale
  before update or delete on profilo
  for each row execute function profilo_principale_protetto();

-- L'account (auth.users) dell'Amministratore principale non si cancella,
-- nemmeno dal pannello Authentication di Supabase: la cancellazione
-- dell'account cancellerebbe anche il profilo (on delete cascade).
create or replace function account_principale_protetto()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profilo where id = old.id and amministratore_principale) then
    raise exception 'L''account dell''Amministratore principale non può essere cancellato. Per farlo, prima togliere la protezione dal SQL Editor (vedi script 29).';
  end if;
  return old;
end $$;

drop trigger if exists trg_account_principale on auth.users;
create trigger trg_account_principale
  before delete on auth.users
  for each row execute function account_principale_protetto();


-- ---------------------------------------------------------------------
-- 3. NOMINA, DECLASSAMENTO E DISATTIVAZIONE DEGLI AMMINISTRATORI
-- ---------------------------------------------------------------------
-- Sostituisce la versione dello script 19. Novità: si può assegnare il
-- ruolo 'admin' e si può cambiare il ruolo di un altro Amministratore,
-- tranne quello principale. Restano: solo Amministratori, mai su sé
-- stessi. Un Amministratore non ha organizzazioni associate.
create or replace function admin_aggiorna_utente(
  p_utente uuid,
  p_ruolo ruolo_utente,
  p_organizzazione uuid
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore può modificare gli utenti';
  end if;
  if p_utente = auth.uid() then
    raise exception 'Non puoi cambiare il tuo ruolo';
  end if;
  if exists (select 1 from profilo where id = p_utente and amministratore_principale) then
    raise exception 'L''Amministratore principale non può essere modificato';
  end if;
  update profilo
    set ruolo = p_ruolo,
        organizzazione_id = case when p_ruolo = 'cliente' then p_organizzazione else null end
  where id = p_utente;
end $$;
grant execute on function admin_aggiorna_utente(uuid, ruolo_utente, uuid) to authenticated;

-- Sostituisce la versione dello script 10: stesso comportamento, con un
-- messaggio chiaro per l'Amministratore principale (lo blocca comunque
-- anche il trigger del punto 2).
create or replace function admin_imposta_attivo(p_utente uuid, p_attivo boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore può disattivare un utente';
  end if;
  if p_utente = auth.uid() and not p_attivo then
    raise exception 'Non puoi disattivare te stesso';
  end if;
  if exists (select 1 from profilo where id = p_utente and amministratore_principale) then
    raise exception 'L''Amministratore principale non può essere disattivato';
  end if;
  update profilo set attivo = p_attivo where id = p_utente;
end $$;
grant execute on function admin_imposta_attivo(uuid, boolean) to authenticated;

-- Id dell'Amministratore principale, per la pagina «Gestione utenti»
-- (mostra il segno «Principale» e nasconde i pulsanti). Solo staff.
create or replace function amministratore_principale_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from profilo where amministratore_principale and app_is_staff() limit 1;
$$;
grant execute on function amministratore_principale_id() to authenticated;


-- ---------------------------------------------------------------------
-- 4. VERIFICA
-- ---------------------------------------------------------------------
-- Deve restituire una riga con l'email luca.moretti@operate.it.
select u.email, p.ruolo, p.attivo, p.amministratore_principale
  from profilo p join auth.users u on u.id = p.id
 where p.amministratore_principale;

-- Per togliere la protezione (solo in caso di reale necessità, dal SQL
-- Editor):
--   update profilo set amministratore_principale = false
--    where amministratore_principale;
