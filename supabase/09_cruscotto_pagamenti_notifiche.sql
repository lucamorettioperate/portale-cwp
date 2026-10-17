-- =====================================================================
--  CRUSCOTTO, RAPPORTI, PAGAMENTI, DOCUMENTI E NOTIFICHE
--  (requisiti §2, §5, §7, §8, §9)
--  Eseguire DOPO 08_integrazioni_azioni.sql, nel SQL Editor di Supabase.
--  Lo script è rieseguibile.
--
--  1. Codice pratica automatico (CWP-2026-0001; rapporti …-RM1).
--  2. Cruscotto del back-office: una riga per pratica con fase corrente,
--     scadenza, integrazioni e consultazione.
--  3. Pagamenti: operatore registrato automaticamente.
--  4. Documenti: lo staff può cambiare la visibilità (audit automatico).
--  5. Notifiche interne su eventi e scadenze.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CODICE PRATICA AUTOMATICO
-- ---------------------------------------------------------------------
create or replace function pratica_codice_automatico()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_anno text := to_char(now(), 'YYYY'); v_n int; v_padre text;
begin
  if new.codice is not null and length(trim(new.codice)) > 0 then
    return new;
  end if;
  if new.tipo = 'rapporto' then
    select codice into v_padre from pratica where id = new.progetto_padre_id;
    new.codice := coalesce(v_padre, 'CWP') || '-RM' || new.anno_monitoraggio;
  else
    select coalesce(max(substring(codice from '^CWP-' || v_anno || '-(\d+)$')::int), 0) + 1
      into v_n from pratica where tipo = 'progetto';
    new.codice := 'CWP-' || v_anno || '-' || lpad(v_n::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_pratica_codice on pratica;
create trigger trg_pratica_codice
  before insert on pratica
  for each row execute function pratica_codice_automatico();

-- Assegna il codice alle pratiche già esistenti che ne sono prive.
do $$
declare r record; v_n int;
begin
  for r in select id, creato_il from pratica
           where tipo = 'progetto' and (codice is null or trim(codice) = '') order by creato_il loop
    select coalesce(max(substring(codice from '^CWP-' || to_char(r.creato_il, 'YYYY') || '-(\d+)$')::int), 0) + 1
      into v_n from pratica where tipo = 'progetto';
    update pratica set codice = 'CWP-' || to_char(r.creato_il, 'YYYY') || '-' || lpad(v_n::text, 4, '0')
     where id = r.id;
  end loop;
  update pratica rap set codice = p.codice || '-RM' || rap.anno_monitoraggio
    from pratica p
   where rap.tipo = 'rapporto' and p.id = rap.progetto_padre_id
     and (rap.codice is null or trim(rap.codice) = '' or rap.codice = 'CWP-RM' || rap.anno_monitoraggio);
end $$;

-- Un Rapporto eredita l'organizzazione del Progetto e segue l'anno precedente.
create or replace function rapporto_coerente()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_tipo tipo_pratica;
begin
  if new.tipo <> 'rapporto' then return new; end if;
  select organizzazione_id, tipo into v_org, v_tipo from pratica where id = new.progetto_padre_id;
  if v_tipo is distinct from 'progetto' then
    raise exception 'Un Rapporto di Monitoraggio deve essere collegato a un Progetto';
  end if;
  new.organizzazione_id := v_org;
  if new.anno_monitoraggio > 1 and not exists (
    select 1 from pratica where progetto_padre_id = new.progetto_padre_id
      and tipo = 'rapporto' and anno_monitoraggio = new.anno_monitoraggio - 1) then
    raise exception 'Il Rapporto dell''anno % richiede prima quello dell''anno %',
      new.anno_monitoraggio, new.anno_monitoraggio - 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_rapporto_coerente on pratica;
create trigger trg_rapporto_coerente
  before insert on pratica
  for each row execute function rapporto_coerente();


-- ---------------------------------------------------------------------
-- 2. CRUSCOTTO DEL BACK-OFFICE
-- ---------------------------------------------------------------------
drop function if exists staff_cruscotto();
create or replace function staff_cruscotto()
returns table (
  id uuid, codice text, tipo tipo_pratica, titolo text, anno_monitoraggio int,
  progetto_padre_id uuid, progetto_padre_codice text,
  organizzazione_id uuid, organizzazione text,
  stato stato_pratica,
  fase_numero int, fase_nome text, fase_stato stato_fase, fase_scadenza date,
  giorni_scadenza int,
  integrazioni_in_attesa int, integrazioni_da_verificare int,
  consultazione_attiva boolean, consultazione_chiusura date,
  aggiornato_il timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_staff() then
    raise exception 'Operazione riservata al back-office';
  end if;
  return query
  select p.id, p.codice, p.tipo, p.titolo, p.anno_monitoraggio,
         p.progetto_padre_id, padre.codice,
         p.organizzazione_id, o.denominazione,
         p.stato,
         fc.numero, fc.nome, fc.stato, fc.data_prevista_chiusura,
         case when fc.stato in ('in_corso','in_attesa_integrazione') and fc.data_prevista_chiusura is not null
              then (fc.data_prevista_chiusura - current_date) end,
         coalesce(ri.attesa, 0)::int, coalesce(ri.verifica, 0)::int,
         coalesce(cs.attiva, false), cs.data_chiusura,
         greatest(p.aggiornato_il, ultimo.quando)
  from pratica p
  join organizzazione o on o.id = p.organizzazione_id
  left join pratica padre on padre.id = p.progetto_padre_id
  -- Fase corrente: l'ultima aperta; se nessuna è aperta, la prima non iniziata;
  -- se tutte completate, l'ultima.
  left join lateral (
    select f.* from fase f where f.pratica_id = p.id
    order by case when f.stato in ('in_corso','in_attesa_integrazione') then 0
                  when f.stato = 'non_iniziata' then 1 else 2 end,
             case when f.stato = 'completata' then -f.numero else f.numero end
    limit 1
  ) fc on true
  left join lateral (
    select count(*) filter (where not r.risolta and r.documento_risposta_id is null) as attesa,
           count(*) filter (where not r.risolta and r.documento_risposta_id is not null) as verifica
    from richiesta_integrazione r where r.pratica_id = p.id
  ) ri on true
  left join lateral (
    select c.attiva, c.data_chiusura from consultazione c
    where c.pratica_id = p.id order by c.creato_il desc limit 1
  ) cs on true
  left join lateral (
    select max(a.avvenuto_il) as quando from audit_event a where a.pratica_id = p.id
  ) ultimo on true
  order by p.codice;
end $$;

grant execute on function staff_cruscotto() to authenticated;


-- ---------------------------------------------------------------------
-- 3. PAGAMENTI: operatore registrato automaticamente
-- ---------------------------------------------------------------------
create or replace function pagamento_operatore()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.registrato_da := coalesce(auth.uid(), new.registrato_da);
  if new.pagato and new.data_pagamento is null then
    new.data_pagamento := current_date;
  end if;
  if not new.pagato then
    new.data_pagamento := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_pagamento_operatore on pagamento;
create trigger trg_pagamento_operatore
  before insert or update on pagamento
  for each row execute function pagamento_operatore();


-- ---------------------------------------------------------------------
-- 4. DOCUMENTI: cambio di visibilità da parte dello staff
--    (la policy doc_update consente già l'aggiornamento allo staff;
--     qui si impedisce di modificare altro che i flag e la tipologia)
-- ---------------------------------------------------------------------
create or replace function documento_solo_flag()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pratica_id is distinct from old.pratica_id
     or new.nome is distinct from old.nome
     or new.versione is distinct from old.versione
     or new.storage_path is distinct from old.storage_path
     or new.hash_file is distinct from old.hash_file
     or new.caricato_da is distinct from old.caricato_da
     or new.creato_il is distinct from old.creato_il then
    raise exception 'Un documento caricato non si modifica: caricane una nuova versione';
  end if;
  return new;
end $$;

drop trigger if exists trg_documento_solo_flag on documento;
create trigger trg_documento_solo_flag
  before update on documento
  for each row execute function documento_solo_flag();


-- ---------------------------------------------------------------------
-- 5. NOTIFICHE INTERNE
-- ---------------------------------------------------------------------
create table if not exists notifica (
  id          uuid primary key default gen_random_uuid(),
  utente_id   uuid not null references auth.users(id) on delete cascade,
  pratica_id  uuid references pratica(id) on delete cascade,
  evento      text not null,
  titolo      text not null,
  testo       text,
  letta       boolean not null default false,
  email_inviata boolean not null default false,  -- per il futuro invio email
  chiave      text,                               -- evita avvisi duplicati (scadenze)
  creato_il   timestamptz not null default now()
);
alter table notifica add column if not exists chiave text;
create index if not exists idx_notifica_utente on notifica (utente_id, letta, creato_il desc);

alter table notifica enable row level security;
drop policy if exists notifica_select on notifica;
create policy notifica_select on notifica for select using (utente_id = auth.uid());
drop policy if exists notifica_update on notifica;
create policy notifica_update on notifica for update
  using (utente_id = auth.uid()) with check (utente_id = auth.uid());
-- Nessuna policy di INSERT/DELETE: le notifiche le crea solo il database.

-- Il destinatario può solo segnare come letta.
create or replace function notifica_solo_letta()
returns trigger
language plpgsql as $$
begin
  if (new.utente_id, new.pratica_id, new.evento, new.titolo, coalesce(new.testo,''), new.creato_il)
     is distinct from (old.utente_id, old.pratica_id, old.evento, old.titolo, coalesce(old.testo,''), old.creato_il) then
    raise exception 'La notifica non è modificabile';
  end if;
  return new;
end $$;
drop trigger if exists trg_notifica_solo_letta on notifica;
create trigger trg_notifica_solo_letta before update on notifica
  for each row execute function notifica_solo_letta();

-- Destinatari.
create or replace function cwp_clienti_pratica(p_pratica uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct pr.id
  from pratica p
  join profilo pr on pr.ruolo = 'cliente' and pr.attivo
  where p.id = p_pratica
    and (pr.organizzazione_id = p.organizzazione_id
         or exists (select 1 from utente_organizzazione uo
                    where uo.utente_id = pr.id and uo.organizzazione_id = p.organizzazione_id));
$$;

create or replace function cwp_staff()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from profilo where ruolo in ('operatore','admin') and attivo;
$$;

-- Crea una notifica per ciascun destinatario (escluso chi ha compiuto l'azione).
create or replace function cwp_notifica(p_destinatari uuid[], p_pratica uuid, p_evento text, p_titolo text, p_testo text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notifica (utente_id, pratica_id, evento, titolo, testo)
  select d, p_pratica, p_evento, p_titolo, p_testo
  from unnest(p_destinatari) d
  where d is not null and d is distinct from auth.uid();
end $$;

create or replace function cwp_etichetta_pratica(p_pratica uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(p.codice, 'pratica') || ' · ' || o.denominazione
  from pratica p join organizzazione o on o.id = p.organizzazione_id where p.id = p_pratica;
$$;

-- Trigger degli eventi da notificare (requisiti §9).
create or replace function notifiche_eventi()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pratica uuid;
  v_etichetta text;
  v_clienti uuid[];
  v_staff uuid[];
begin
  -- (to_jsonb: la tabella pratica non ha la colonna pratica_id)
  v_pratica := coalesce((to_jsonb(new) ->> 'pratica_id')::uuid, (to_jsonb(new) ->> 'id')::uuid);
  v_etichetta := cwp_etichetta_pratica(v_pratica);
  v_clienti := array(select cwp_clienti_pratica(v_pratica));
  v_staff := array(select cwp_staff());

  -- Condizioni annidate: ogni tabella ha campi diversi.
  if tg_table_name = 'fase' then
    if tg_op = 'UPDATE' and new.stato is distinct from old.stato then
      if new.stato = 'in_corso' and old.stato = 'non_iniziata' then
        perform cwp_notifica(v_clienti, v_pratica, 'apertura_fase',
          'Aperta la fase «' || new.nome || '»',
          v_etichetta || coalesce(' — scadenza ' || to_char(new.data_prevista_chiusura, 'DD/MM/YYYY'), ''));
      elsif new.stato = 'completata' then
        perform cwp_notifica(v_clienti, v_pratica, 'chiusura_fase',
          'Completata la fase «' || new.nome || '»', v_etichetta);
      end if;
    end if;

  elsif tg_table_name = 'richiesta_integrazione' then
    if tg_op = 'INSERT' then
      perform cwp_notifica(v_clienti, v_pratica, 'richiesta_integrazione',
        'Nuova richiesta di integrazione', v_etichetta || ' — ' || new.descrizione);
    elsif new.documento_risposta_id is distinct from old.documento_risposta_id then
      perform cwp_notifica(v_staff, v_pratica, 'risposta_integrazione',
        'Il Cliente ha risposto a una richiesta di integrazione', v_etichetta || ' — ' || new.descrizione);
    end if;

  elsif tg_table_name = 'documento' then
    if tg_op = 'INSERT' then
      if app_is_staff() then
        if new.visibile_cliente or new.pubblico then
          perform cwp_notifica(v_clienti, v_pratica, 'nuovo_documento',
            'Nuovo documento disponibile', v_etichetta || ' — ' || new.nome || ' (v' || new.versione || ')');
        end if;
      else
        perform cwp_notifica(v_staff, v_pratica, 'nuovo_documento',
          'Il Cliente ha caricato un documento', v_etichetta || ' — ' || new.nome || ' (v' || new.versione || ')');
      end if;
    end if;

  elsif tg_table_name = 'consultazione' then
    if tg_op = 'INSERT' then
      perform cwp_notifica(v_clienti, v_pratica, 'apertura_consultazione',
        'Aperta la consultazione pubblica',
        v_etichetta || ' — fino al ' || coalesce(to_char(new.data_chiusura, 'DD/MM/YYYY'), '—'));
    end if;

  elsif tg_table_name = 'commento' then
    if tg_op = 'INSERT' then
      perform cwp_notifica(v_staff, v_pratica, 'nuovo_commento',
        'Nuova osservazione da moderare', v_etichetta);
    end if;

  elsif tg_table_name = 'pratica' then
    if tg_op = 'UPDATE' and new.stato is distinct from old.stato then
      perform cwp_notifica(v_clienti, v_pratica,
        case when new.stato = 'chiusa' then 'chiusura_pratica' else 'cambio_stato' end,
        'Pratica ' || case new.stato when 'attiva' then 'riattivata' when 'sospesa' then 'sospesa'
                                     when 'annullata' then 'annullata' else 'chiusa' end,
        v_etichetta || coalesce(' — ' || new.motivazione_stato, ''));
    end if;
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['fase','richiesta_integrazione','documento','consultazione','commento','pratica'] loop
    execute format('drop trigger if exists trg_notifiche on %I', t);
    execute format(
      'create trigger trg_notifiche after insert or update on %I
         for each row execute function notifiche_eventi()', t);
  end loop;
end $$;

-- Scadenze: avviso a 3 giorni e a scadenza superata (una sola volta per fase
-- e tipo di avviso). Da eseguire ogni giorno (vedi pianificazione sotto).
create or replace function genera_notifiche_scadenze()
returns int
language plpgsql security definer set search_path = public as $$
declare f record; v_n int := 0; v_evento text; v_titolo text;
begin
  for f in
    select fa.*, p.stato as stato_pratica from fase fa join pratica p on p.id = fa.pratica_id
    where fa.stato in ('in_corso','in_attesa_integrazione')
      and fa.data_prevista_chiusura is not null
      and p.stato = 'attiva'
      and fa.data_prevista_chiusura - current_date <= 3
  loop
    if f.data_prevista_chiusura < current_date then
      v_evento := 'fase_scaduta';
      v_titolo := 'Fase scaduta: «' || f.nome || '»';
    else
      v_evento := 'scadenza_vicina';
      v_titolo := 'Scadenza vicina: «' || f.nome || '» (' || to_char(f.data_prevista_chiusura, 'DD/MM/YYYY') || ')';
    end if;
    -- una sola volta per fase, tipo di avviso e scadenza
    if not exists (select 1 from notifica n
                    where n.chiave = v_evento || ':' || f.id || ':' || f.data_prevista_chiusura) then
      insert into notifica (utente_id, pratica_id, evento, titolo, testo, chiave)
      select d, f.pratica_id, v_evento, v_titolo, cwp_etichetta_pratica(f.pratica_id),
             v_evento || ':' || f.id || ':' || f.data_prevista_chiusura
      from unnest(array(select cwp_clienti_pratica(f.pratica_id)) || array(select cwp_staff())) d;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- Pianificazione giornaliera (ore 7:00 italiane ≈ 5:00 UTC) se pg_cron è disponibile.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron non disponibile: avvisi di scadenza da attivare manualmente';
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cwp_notifiche_scadenze';
    perform cron.schedule('cwp_notifiche_scadenze', '0 5 * * *', 'select public.genera_notifiche_scadenze()');
  end if;
end $$;
