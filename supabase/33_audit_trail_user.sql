-- =====================================================================
--  33 — AUDIT USER (solo Amministratore principale; sezione chiamata
--       «Audit trail user» fino al 20/10/2026, file con il nome di allora)
--
--  Scopo (richiesta di Luca del 20/10/2026): una sezione del portale
--  riservata all'Amministratore principale (luca.moretti@operate.it,
--  script 29) con, per ogni utente:
--   - stato online o non collegato (presenza, script 32);
--   - registro degli ACCESSI: entrate, uscite e tentativi di accesso non
--     riusciti, con data e ora;
--   - registro delle OPERAZIONI: tutto l'audit trail (audit_event) di
--     quell'utente, con data e ora, più lo scaricamento dei documenti.
--
--  Cosa aggiunge:
--   1. tabella registro_accessi: append-only (non si modifica né si
--      cancella), non leggibile dal browser; la scrivono solo le funzioni
--      qui sotto. Nessun indirizzo IP: utente, email, evento, ora.
--   2. registra_accesso() e registra_uscita(): il portale le chiama dopo
--      un accesso riuscito e quando l'utente preme «Esci» (l'uscita
--      cancella anche la presenza dello script 32);
--      registra_accesso_fallito(email): dalla pagina di accesso, anche
--      senza essere collegati, con un limite (10 per email ogni 15 minuti,
--      300 in tutto all'ora) per evitare abusi.
--   3. registra_download(percorso): scrive nell'audit trail lo
--      scaricamento di un documento di una pratica («download documento»).
--   4. Funzioni di lettura SOLO per l'Amministratore principale:
--      audit_utenti_stato(), audit_registro_accessi(...),
--      audit_operazioni_utente(...).
--
--  Nota: chi ha fatto almeno un accesso risulta «attivo» e non si può più
--  cancellare (solo disattivare): la riga del registro lo collega
--  all'utente (utente_mai_attivo, script 30).
--
--  Eseguire DOPO lo script 32, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 33; backlog 40.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. CHI È L'AMMINISTRATORE PRINCIPALE (uso interno)
-- ---------------------------------------------------------------------
-- Vero se l'utente collegato è l'Amministratore principale attivo (e ha
-- la verifica a due fattori, se obbligatoria: app_is_admin).
create or replace function app_e_principale()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_is_admin(), false)
     and exists (select 1 from profilo where id = auth.uid() and amministratore_principale and attivo);
$$;


-- ---------------------------------------------------------------------
-- 1. REGISTRO DEGLI ACCESSI
-- ---------------------------------------------------------------------
create table if not exists registro_accessi (
  id          bigint generated always as identity primary key,
  avvenuto_il timestamptz not null default now(),
  utente_id   uuid references auth.users(id) on delete set null,
  email       text,                                  -- resta anche se l'utente non c'è più
  evento      text not null check (evento in ('accesso', 'uscita', 'accesso_non_riuscito')),
  dettaglio   jsonb
);
create index if not exists idx_registro_accessi_data on registro_accessi (avvenuto_il desc);
create index if not exists idx_registro_accessi_utente on registro_accessi (utente_id, avvenuto_il desc);
create index if not exists idx_registro_accessi_email on registro_accessi (lower(email), avvenuto_il desc);
alter table registro_accessi enable row level security;
-- Nessuna regola (policy): dal browser non si legge né si scrive.

-- Immutabile come l'audit trail (funzione audit_immutabile, script 07).
drop trigger if exists trg_registro_accessi_immutabile on registro_accessi;
create trigger trg_registro_accessi_immutabile
  before update or delete on registro_accessi
  for each row execute function audit_immutabile();


-- ---------------------------------------------------------------------
-- 2. SCRITTURA DEGLI EVENTI DI ACCESSO
-- ---------------------------------------------------------------------
-- Accesso riuscito dell'utente collegato. Parametro facoltativo: modo
-- («password», «recupero»…), solo informativo.
create or replace function registra_accesso(p_modo text default 'password')
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into registro_accessi (utente_id, email, evento, dettaglio)
  select auth.uid(), u.email, 'accesso', jsonb_build_object('modo', left(coalesce(p_modo, 'password'), 30))
    from auth.users u where u.id = auth.uid();
end $$;
grant execute on function registra_accesso(text) to authenticated;

-- Uscita con «Esci»: registra l'evento e cancella la presenza (script 32).
create or replace function registra_uscita()
returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_dal timestamptz;
begin
  if auth.uid() is null then
    return;
  end if;
  select collegato_dal into v_dal from presenza where utente_id = auth.uid();
  insert into registro_accessi (utente_id, email, evento, dettaglio)
  select auth.uid(), u.email, 'uscita',
         case when v_dal is null then null
              else jsonb_build_object('minuti_collegato', round(extract(epoch from now() - v_dal) / 60)) end
    from auth.users u where u.id = auth.uid();
  delete from presenza where utente_id = auth.uid();
end $$;
grant execute on function registra_uscita() to authenticated;

-- Tentativo di accesso non riuscito (email o password errate). Si chiama
-- dalla pagina di accesso, quindi anche senza sessione (anon). Limiti:
-- al massimo 10 registrazioni per email ogni 15 minuti e 300 in tutto
-- all'ora; oltre si ignora in silenzio. Non dice se l'email esiste.
create or replace function registra_accesso_fallito(p_email text)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text := lower(trim(left(coalesce(p_email, ''), 254)));
  v_id uuid;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return;
  end if;
  if (select count(*) from registro_accessi
       where evento = 'accesso_non_riuscito' and lower(email) = v_email
         and avvenuto_il > now() - interval '15 minutes') >= 10
     or (select count(*) from registro_accessi
          where evento = 'accesso_non_riuscito' and avvenuto_il > now() - interval '1 hour') >= 300 then
    return;
  end if;
  select id into v_id from auth.users where lower(email) = v_email limit 1;
  insert into registro_accessi (utente_id, email, evento, dettaglio)
  values (v_id, v_email, 'accesso_non_riuscito',
          jsonb_build_object('utente_esistente', v_id is not null));
end $$;
grant execute on function registra_accesso_fallito(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. SCARICAMENTO DEI DOCUMENTI NELL'AUDIT TRAIL
-- ---------------------------------------------------------------------
-- Parametro: percorso del file nell'archivio «documenti» (la prima
-- cartella è l'id della pratica). Si registra solo se il documento esiste
-- e l'utente lo può vedere: stessa regola della lettura dei documenti
-- (policy doc_select, script 02: staff, oppure Comune della pratica con
-- documento visibile al cliente o pubblico). Così nessuno può scrivere
-- nell'audit scaricamenti di documenti che non vede.
create or replace function registra_download(p_percorso text)
returns void
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  if auth.uid() is null or p_percorso is null then
    return;
  end if;
  select id, pratica_id, nome, versione into d
    from documento
   where storage_path = p_percorso
     and (app_is_staff() or (pratica_mia(pratica_id) and (visibile_cliente or pubblico)))
   limit 1;
  if d.id is null then
    return;
  end if;
  insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, oggetto_id, pratica_id, dettaglio)
  values (auth.uid(), app_ruolo(), 'download documento', 'documento', d.id, d.pratica_id,
          jsonb_build_object('nome', d.nome, 'versione', d.versione));
end $$;
grant execute on function registra_download(text) to authenticated;
-- Versione precedente in due parti (mai pubblicata): si toglie se c'è.
drop function if exists registra_download_scrivi(uuid, uuid, text, int);


-- ---------------------------------------------------------------------
-- 4. LETTURA: SOLO AMMINISTRATORE PRINCIPALE
-- ---------------------------------------------------------------------
-- Tutti gli utenti con stato online, ultimo accesso e ultime operazioni.
-- Online = presenza segnalata da meno di 2 minuti (script 32).
create or replace function audit_utenti_stato()
returns table (
  id uuid, email text, nome_completo text, ruolo ruolo_utente, attivo boolean,
  organizzazione text, online boolean, pagina text, visto_il timestamptz,
  collegato_dal timestamptz, ultimo_accesso timestamptz, accessi_30 bigint,
  falliti_30 bigint, ultima_operazione timestamptz, operazioni_30 bigint
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not app_e_principale() then
    raise exception 'Riservato all''Amministratore principale';
  end if;
  return query
    select p.id, u.email::text, p.nome_completo, p.ruolo, p.attivo, o.denominazione,
           coalesce(pr.visto_il > now() - interval '2 minutes', false), pr.pagina, pr.visto_il, pr.collegato_dal,
           (select max(r.avvenuto_il) from registro_accessi r where r.utente_id = p.id and r.evento = 'accesso'),
           (select count(*) from registro_accessi r where r.utente_id = p.id and r.evento = 'accesso' and r.avvenuto_il > now() - interval '30 days'),
           (select count(*) from registro_accessi r where (r.utente_id = p.id or lower(r.email) = lower(u.email)) and r.evento = 'accesso_non_riuscito' and r.avvenuto_il > now() - interval '30 days'),
           (select max(a.avvenuto_il) from audit_event a where a.utente_id = p.id),
           (select count(*) from audit_event a where a.utente_id = p.id and a.avvenuto_il > now() - interval '30 days')
      from profilo p
      join auth.users u on u.id = p.id
      left join organizzazione o on o.id = p.organizzazione_id
      left join presenza pr on pr.utente_id = p.id
     order by coalesce(pr.visto_il > now() - interval '2 minutes', false) desc, pr.visto_il desc nulls last, u.email;
end $$;
grant execute on function audit_utenti_stato() to authenticated;

-- Registro degli accessi, dal più recente. Filtri facoltativi: utente,
-- periodo (dal / al compresi), evento; al massimo p_limite righe (≤ 5000).
create or replace function audit_registro_accessi(
  p_utente uuid default null, p_dal timestamptz default null, p_al timestamptz default null,
  p_evento text default null, p_limite int default 500)
returns table (
  id bigint, avvenuto_il timestamptz, utente_id uuid, email text, nome_completo text,
  ruolo ruolo_utente, evento text, dettaglio jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_e_principale() then
    raise exception 'Riservato all''Amministratore principale';
  end if;
  return query
    select r.id, r.avvenuto_il, r.utente_id, r.email, p.nome_completo, p.ruolo, r.evento, r.dettaglio
      from registro_accessi r
      left join profilo p on p.id = r.utente_id
     where (p_utente is null or r.utente_id = p_utente)
       and (p_dal is null or r.avvenuto_il >= p_dal)
       and (p_al is null or r.avvenuto_il < p_al)
       and (p_evento is null or r.evento = p_evento)
     order by r.avvenuto_il desc
     limit least(greatest(coalesce(p_limite, 500), 1), 5000);
end $$;
grant execute on function audit_registro_accessi(uuid, timestamptz, timestamptz, text, int) to authenticated;

-- Operazioni dell'audit trail, dal più recente, con nome dell'utente e
-- codice della pratica. Filtri facoltativi come sopra.
create or replace function audit_operazioni_utente(
  p_utente uuid default null, p_dal timestamptz default null, p_al timestamptz default null,
  p_limite int default 500)
returns table (
  id bigint, avvenuto_il timestamptz, utente_id uuid, email text, nome_completo text,
  ruolo ruolo_utente, operazione text, oggetto_tipo text, oggetto_id uuid, pratica text,
  stato_precedente text, stato_successivo text, motivazione text, dettaglio jsonb
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not app_e_principale() then
    raise exception 'Riservato all''Amministratore principale';
  end if;
  return query
    select a.id, a.avvenuto_il, a.utente_id, u.email::text, p.nome_completo, a.ruolo, a.operazione,
           a.oggetto_tipo, a.oggetto_id, pt.codice, a.stato_precedente, a.stato_successivo, a.motivazione, a.dettaglio
      from audit_event a
      left join auth.users u on u.id = a.utente_id
      left join profilo p on p.id = a.utente_id
      left join pratica pt on pt.id = a.pratica_id
     where (p_utente is null or a.utente_id = p_utente)
       and (p_dal is null or a.avvenuto_il >= p_dal)
       and (p_al is null or a.avvenuto_il < p_al)
     order by a.avvenuto_il desc
     limit least(greatest(coalesce(p_limite, 500), 1), 5000);
end $$;
grant execute on function audit_operazioni_utente(uuid, timestamptz, timestamptz, int) to authenticated;

-- Verifica: deve restituire 0 (registro vuoto finché nessuno entra).
select count(*) as accessi_registrati from registro_accessi;
