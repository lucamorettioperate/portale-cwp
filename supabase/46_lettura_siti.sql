-- =====================================================================
--  46 — MARKETING: LETTORE DEI SITI DI COMUNI E GESTORI
--
--  Richiesta di Luca Moretti del 25/10/2026: «devi cercare nei singoli
--  siti internet di ogni gestore e comune» (recapiti e referenti).
--  Versione GRATUITA scelta da Luca alle 11:39: i dati si riconoscono con
--  regole fisse nel codice (src/lib/marketingLettura.js, estraiDati),
--  nessun servizio a pagamento. Le colonne token_in e token_out restano a
--  zero (servirebbero solo se in futuro si usasse un servizio a consumo).
--
--  Come funziona:
--  - mkt_lettura: coda di lettura, una riga per ente con sito (stato
--    in_coda, in_corso, fatto, errore, escluso), con pagine lette, esito
--    (dati trovati e controllati) e token usati;
--  - un lavoro pianificato ogni 30 secondi chiama la funzione del server
--    «marketing» (azione leggi_siti) solo se la lettura è accesa
--    (impostazione mkt_lettura_attiva = 'si'); la chiamata porta un codice
--    segreto generato qui (impostazione mkt_lettura_segreto, non leggibile
--    dal portale) e la funzione prende pochi enti alla volta
--    (mkt_lettura_prendi, con «skip locked»: nessun ente letto due volte);
--  - gli Amministratori mettono in coda, accendono e spengono la lettura e
--    vedono il riepilogo (admin_mkt_lettura_*).
--  I dati trovati riempiono solo i campi vuoti dell'ente; i referenti
--  hanno la fonte (pagina del sito) e la chiave «sito:…».
--
--  Rieseguibile. Prova: t46.sql sul banco locale.
--  Registro sviluppo e deploy: capitolo 16 «Marketing».
-- =====================================================================

create table if not exists mkt_lettura (
  ente_id     bigint primary key references mkt_ente(id) on delete cascade,
  stato       text not null default 'in_coda' check (stato in ('in_coda', 'in_corso', 'fatto', 'errore', 'escluso')),
  tentativi   int not null default 0,
  pagine      text[] not null default '{}',
  esito       jsonb,
  errore      text,
  token_in    int not null default 0,
  token_out   int not null default 0,
  in_coda_il  timestamptz not null default now(),
  iniziata_il timestamptz,
  letto_il    timestamptz
);
create index if not exists idx_mkt_lettura_stato on mkt_lettura (stato, in_coda_il);

alter table mkt_lettura enable row level security;
drop policy if exists mkt_lettura_admin on mkt_lettura;
create policy mkt_lettura_admin on mkt_lettura for all using ((select app_is_admin())) with check ((select app_is_admin()));
revoke all on mkt_lettura from anon;
grant select, insert, update, delete on mkt_lettura to authenticated;

-- Impostazioni: lettura spenta all'inizio, codice segreto per il lavoro
-- pianificato, indirizzo della funzione.
insert into impostazione (chiave, valore) values ('mkt_lettura_attiva', 'no') on conflict (chiave) do nothing;
insert into impostazione (chiave, valore) values ('mkt_lettura_segreto', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict (chiave) do nothing;
insert into impostazione (chiave, valore) values ('url_marketing', 'https://ajxrnofgunynkynozmrn.supabase.co/functions/v1/marketing') on conflict (chiave) do nothing;

-- Mette in coda gli enti con sito: p_tipo 'comune', 'gestore' o null
-- (tutti); p_ripeti = true rimette in coda anche quelli già letti o in
-- errore. Restituisce quanti enti sono entrati in coda.
create or replace function admin_mkt_lettura_accoda(p_tipo text, p_ripeti boolean default false)
returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not app_is_admin() then raise exception 'Operazione riservata agli amministratori'; end if;
  insert into mkt_lettura (ente_id)
  select e.id from mkt_ente e
   where e.sito is not null and length(trim(e.sito)) > 4
     and (p_tipo is null or e.tipo = p_tipo)
  on conflict (ente_id) do update set stato = 'in_coda', tentativi = 0, errore = null, in_coda_il = now()
   where p_ripeti and mkt_lettura.stato in ('fatto', 'errore');
  get diagnostics v = row_count;
  return v;
end $$;
revoke execute on function admin_mkt_lettura_accoda(text, boolean) from public, anon;
grant execute on function admin_mkt_lettura_accoda(text, boolean) to authenticated;

-- Accende o spegne la lettura automatica.
create or replace function admin_mkt_lettura_attiva(p_attiva boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then raise exception 'Operazione riservata agli amministratori'; end if;
  update impostazione set valore = case when p_attiva then 'si' else 'no' end, aggiornato_il = now()
   where chiave = 'mkt_lettura_attiva';
end $$;
revoke execute on function admin_mkt_lettura_attiva(boolean) from public, anon;
grant execute on function admin_mkt_lettura_attiva(boolean) to authenticated;

-- Riepilogo per la pagina Importazioni.
create or replace function admin_mkt_lettura_riepilogo()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then raise exception 'Operazione riservata agli amministratori'; end if;
  return jsonb_build_object(
    'attiva', (select valore = 'si' from impostazione where chiave = 'mkt_lettura_attiva'),
    'per_stato', coalesce((select jsonb_object_agg(k, n) from (
        select e.tipo || ':' || l.stato as k, count(*) as n
          from mkt_lettura l join mkt_ente e on e.id = l.ente_id group by 1) x), '{}'::jsonb),
    'token_in', (select coalesce(sum(token_in), 0) from mkt_lettura),
    'token_out', (select coalesce(sum(token_out), 0) from mkt_lettura),
    'ultima', (select max(letto_il) from mkt_lettura),
    'ultimi_errori', coalesce((select jsonb_agg(x) from (
        select e.denominazione, l.errore from mkt_lettura l join mkt_ente e on e.id = l.ente_id
         where l.stato = 'errore' order by l.letto_il desc nulls last limit 5) x), '[]'::jsonb)
  );
end $$;
revoke execute on function admin_mkt_lettura_riepilogo() from public, anon;
grant execute on function admin_mkt_lettura_riepilogo() to authenticated;

-- Prende i prossimi p_n enti da leggere (solo la funzione del server, con
-- la chiave di servizio). Gli enti rimasti «in_corso» da più di 10 minuti
-- (lettura interrotta) tornano in coda; dopo 3 tentativi vanno in errore.
create or replace function mkt_lettura_prendi(p_n int)
returns table (ente_id bigint, tipo text, denominazione text, sito text, comune_sede text, sigla text)
language plpgsql security definer set search_path = public as $$
begin
  update mkt_lettura set stato = case when tentativi >= 3 then 'errore' else 'in_coda' end,
         errore = case when tentativi >= 3 then 'Lettura interrotta tre volte' else errore end
   where stato = 'in_corso' and iniziata_il < now() - interval '10 minutes';
  return query
  with scelti as (
    select l.ente_id from mkt_lettura l
     where l.stato = 'in_coda'
     order by l.in_coda_il, l.ente_id
     limit greatest(1, least(p_n, 20))
     for update skip locked
  ), presi as (
    update mkt_lettura l set stato = 'in_corso', iniziata_il = now(), tentativi = l.tentativi + 1
      from scelti s where l.ente_id = s.ente_id
    returning l.ente_id
  )
  select e.id, e.tipo, e.denominazione, e.sito, e.comune_sede, e.sigla
    from presi p join mkt_ente e on e.id = p.ente_id;
end $$;
revoke execute on function mkt_lettura_prendi(int) from public, anon, authenticated;

-- Chiamata del lavoro pianificato: solo se la lettura è accesa e c'è
-- qualcosa in coda.
create or replace function richiedi_lettura_siti()
returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_segreto text;
begin
  if coalesce((select valore from impostazione where chiave = 'mkt_lettura_attiva'), 'no') <> 'si' then return; end if;
  if not exists (select 1 from mkt_lettura where stato = 'in_coda') then return; end if;
  select valore into v_url from impostazione where chiave = 'url_marketing';
  select valore into v_segreto from impostazione where chiave = 'mkt_lettura_segreto';
  if v_url is null or v_segreto is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('azione', 'leggi_siti', 'segreto', v_segreto),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 150000
  );
exception when others then
  raise warning 'Lettura dei siti non richiesta: %', sqlerrm;
end $$;
revoke execute on function richiedi_lettura_siti() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cwp_lettura_siti';
    perform cron.schedule('cwp_lettura_siti', '30 seconds', 'select public.richiedi_lettura_siti()');
  else
    raise warning 'pg_cron non è attivo: la lettura dei siti si può avviare solo dalla pagina Importazioni.';
  end if;
end $$;

-- Verifica (solo lettura).
select (select count(*) from information_schema.tables where table_name = 'mkt_lettura') as tabella,
       (select valore from impostazione where chiave = 'mkt_lettura_attiva') as lettura_attiva,
       (select count(*) from impostazione where chiave = 'mkt_lettura_segreto') as segreto_presente;
