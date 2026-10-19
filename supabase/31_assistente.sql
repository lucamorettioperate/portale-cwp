-- =====================================================================
--  31 — ASSISTENTE VIRTUALE: CONTEGGIO DELL'USO
--
--  Scopo: la funzione del server «assistente» (Claude di Anthropic)
--  registra quante domande fa ogni utente al giorno e i token usati, per
--  applicare un limite giornaliero e controllare la spesa. Nessun testo
--  delle domande o delle risposte viene salvato.
--
--  Sicurezza: la tabella si scrive solo dalla funzione del server (chiave
--  di servizio, funzione assistente_registra_uso); ogni utente legge solo
--  le proprie righe; gli Amministratori leggono il riepilogo di tutti
--  (assistente_riepilogo_uso).
--
--  Eseguire DOPO lo script 30, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 31; capitolo 5
--  «Edge Functions» (assistente).
-- =====================================================================

create table if not exists assistente_uso (
  utente_id  uuid not null references auth.users(id) on delete cascade,
  giorno     date not null default (now() at time zone 'Europe/Rome')::date,
  domande    int not null default 0,
  token_ingresso bigint not null default 0,  -- token in entrata (compresi quelli letti dalla cache)
  token_uscita   bigint not null default 0,
  primary key (utente_id, giorno)
);
alter table assistente_uso enable row level security;

drop policy if exists assistente_uso_proprio on assistente_uso;
create policy assistente_uso_proprio on assistente_uso for select
  using (utente_id = auth.uid());

-- Aggiunge una domanda all'utente per oggi (ora italiana) e restituisce il
-- totale delle domande di oggi. Solo la funzione del server (chiave di
-- servizio): agli utenti del portale l'esecuzione è tolta.
create or replace function assistente_registra_uso(p_utente uuid, p_ingresso bigint, p_uscita bigint)
returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into assistente_uso (utente_id, giorno, domande, token_ingresso, token_uscita)
  values (p_utente, (now() at time zone 'Europe/Rome')::date, 1, coalesce(p_ingresso, 0), coalesce(p_uscita, 0))
  on conflict (utente_id, giorno) do update
    set domande = assistente_uso.domande + 1,
        token_ingresso = assistente_uso.token_ingresso + coalesce(p_ingresso, 0),
        token_uscita = assistente_uso.token_uscita + coalesce(p_uscita, 0)
  returning domande into v;
  return v;
end $$;
revoke execute on function assistente_registra_uso(uuid, bigint, bigint) from public, anon, authenticated;

-- Domande fatte oggi da un utente (per il limite giornaliero). Solo la
-- funzione del server.
create or replace function assistente_domande_oggi(p_utente uuid)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select domande from assistente_uso
                    where utente_id = p_utente and giorno = (now() at time zone 'Europe/Rome')::date), 0);
$$;
revoke execute on function assistente_domande_oggi(uuid) from public, anon, authenticated;

-- Riepilogo per gli Amministratori: domande e token per mese.
create or replace function assistente_riepilogo_uso()
returns table (mese text, utenti bigint, domande bigint, token_ingresso numeric, token_uscita numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Riservato agli amministratori';
  end if;
  return query
    select to_char(giorno, 'YYYY-MM'), count(distinct utente_id), sum(a.domande)::bigint,
           sum(a.token_ingresso)::numeric, sum(a.token_uscita)::numeric
      from assistente_uso a
     group by 1 order by 1 desc;
end $$;
grant execute on function assistente_riepilogo_uso() to authenticated;

select 'assistente_uso pronta' as esito;
