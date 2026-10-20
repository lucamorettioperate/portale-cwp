-- =====================================================================
--  32 — UTENTI ONLINE (solo Amministratore principale)
--
--  Scopo: l'Amministratore principale (script 29) vede quanti e quali
--  utenti sono collegati al portale in questo momento, in quale pagina
--  sono e da quanto, più gli accessi delle ultime 24 ore.
--
--  Come funziona: il portale, mentre una pagina riservata è aperta e
--  visibile, «segnala la presenza» una volta al minuto e a ogni cambio di
--  pagina (funzione segnala_presenza). Un utente è online se l'ultima
--  segnalazione ha meno di 2 minuti. Con «Esci» la presenza si cancella.
--
--  Dati conservati: solo l'ultima segnalazione per utente (ora, pagina
--  aperta, inizio del collegamento). Nessun indirizzo IP, nessuno
--  storico: ogni segnalazione sostituisce la precedente. Nessuna voce
--  nell'audit (sarebbe una voce al minuto per utente).
--
--  Sicurezza: la tabella non è leggibile né scrivibile direttamente (RLS
--  senza regole); ognuno aggiorna solo la propria presenza con le
--  funzioni; l'elenco lo legge solo l'Amministratore principale.
--
--  Eseguire DOPO lo script 31, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 32; backlog 38.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABELLA DELLE PRESENZE (una riga per utente)
-- ---------------------------------------------------------------------
create table if not exists presenza (
  utente_id  uuid primary key references auth.users(id) on delete cascade,
  visto_il   timestamptz not null default now(),   -- ultima segnalazione
  collegato_dal timestamptz not null default now(), -- inizio del collegamento
  pagina     text                                   -- indirizzo aperto (es. /pratiche)
);
alter table presenza enable row level security;
-- Nessuna regola (policy): dal portale si passa solo dalle funzioni qui sotto.


-- ---------------------------------------------------------------------
-- 2. SEGNALAZIONE E USCITA (ogni utente, solo per sé)
-- ---------------------------------------------------------------------
-- Aggiorna la presenza dell'utente collegato. Se l'ultima segnalazione ha
-- più di 5 minuti, è un nuovo collegamento (riparte «collegato dal»).
-- Parametro: indirizzo della pagina aperta (al massimo 200 caratteri).
create or replace function segnala_presenza(p_pagina text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null
     or not exists (select 1 from profilo where id = auth.uid() and attivo) then
    return;
  end if;
  insert into presenza (utente_id, visto_il, collegato_dal, pagina)
  values (auth.uid(), now(), now(), left(p_pagina, 200))
  on conflict (utente_id) do update
    set visto_il = now(),
        pagina = left(excluded.pagina, 200),
        collegato_dal = case when presenza.visto_il < now() - interval '5 minutes'
                             then now() else presenza.collegato_dal end;
end $$;
grant execute on function segnala_presenza(text) to authenticated;

-- Con «Esci» l'utente non risulta più online.
create or replace function presenza_uscita()
returns void
language sql security definer set search_path = public as $$
  delete from presenza where utente_id = auth.uid();
$$;
grant execute on function presenza_uscita() to authenticated;


-- ---------------------------------------------------------------------
-- 3. ELENCO PER L'AMMINISTRATORE PRINCIPALE
-- ---------------------------------------------------------------------
-- Utenti visti nelle ultime 24 ore, dal più recente, con «online» vero se
-- l'ultima segnalazione ha meno di 2 minuti. Solo per l'Amministratore
-- principale (attivo, con verifica a due fattori se obbligatoria).
create or replace function utenti_online()
returns table (
  id uuid,
  email text,
  nome_completo text,
  ruolo ruolo_utente,
  organizzazione text,
  pagina text,
  visto_il timestamptz,
  collegato_dal timestamptz,
  online boolean
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not app_is_admin()
     or not exists (select 1 from profilo x where x.id = auth.uid() and x.amministratore_principale) then
    raise exception 'Riservato all''Amministratore principale';
  end if;
  return query
    select p.id, u.email::text, p.nome_completo, p.ruolo, o.denominazione,
           pr.pagina, pr.visto_il, pr.collegato_dal,
           pr.visto_il > now() - interval '2 minutes'
      from presenza pr
      join profilo p on p.id = pr.utente_id
      join auth.users u on u.id = pr.utente_id
      left join organizzazione o on o.id = p.organizzazione_id
     where pr.visto_il > now() - interval '24 hours'
     order by pr.visto_il desc;
end $$;
grant execute on function utenti_online() to authenticated;

-- Verifica: deve restituire la tabella (vuota finché nessuno apre il portale).
select count(*) as presenze_registrate from presenza;
