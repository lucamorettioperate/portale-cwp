-- =====================================================================
--  PIATTAFORMA PUBBLICA, CREDITI EMESSI E RECLAMI (18/10/2026)
--  Eseguire DOPO 23_allineamento_guida.sql. Lo script è rieseguibile.
--  Registro sviluppo e deploy: capitolo «Database», cronologia del 18/10.
--
--   1. Informazioni del Programma (soggetto promotore del programma, PEC,
--      sito): le imposta l'Amministratore (Guida 3.1 e 3.6).
--   2. Registri (Guida 3.5, Standard 6) e metodologie approvate (Guida 5):
--      elenchi pubblicati sulla piattaforma online (Guida 3.7).
--   3. Modelli e documenti del Programma pubblici (modulistica, Guida 3.7).
--   4. Crediti emessi: lotti con ID univoco dopo la registrazione del
--      Rapporto (Guida 6.3.2), caricamento sul registro scelto, vendite
--      comunicate dal registro e dichiarazione di cancellazione tombale
--      entro 10 giorni (Guida 6.3.3, Tabella 5; Standard 6.2). Stato dei
--      crediti: attivo (disponibile alla vendita) o ritirato (cancellato).
--   5. Reclami e richieste di chiarimento (Politica di reclamo, Guida 8).
--   6. Dati pubblici della piattaforma per la pagina /programma, letti
--      solo dalla Edge Function consultazione-pubblica.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. INFORMAZIONI DEL PROGRAMMA
-- ---------------------------------------------------------------------
-- Valori iniziali dalla Guida 3.1 e 3.6: il soggetto promotore del
-- programma è oggi lo Studio Associato Wastelab, che all'avvio della
-- piattaforma incarica un soggetto giuridico. L'Amministratore li aggiorna.
insert into impostazione (chiave, valore) values
  ('programma_soggetto_promotore', 'Studio Associato Wastelab, Pesaro (Guida al Programma, cap. 3.1), in attesa dell''incarico al soggetto giuridico che gestirà la piattaforma'),
  ('programma_pec', ''),
  ('programma_email', 'info@carbonwasteprint.com'),
  ('programma_sito', 'www.carbonwasteprint.com')
on conflict (chiave) do nothing;

-- Le informazioni del Programma, per tutti gli utenti autenticati.
create or replace function info_programma()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(replace(chiave, 'programma_', ''), valore), '{}'::jsonb)
    from impostazione where chiave like 'programma\_%';
$$;
grant execute on function info_programma() to authenticated;

-- L'Amministratore cambia una delle informazioni del Programma (nell'audit).
create or replace function admin_imposta_info_programma(p_chiave text, p_valore text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_prima text;
begin
  if not app_is_admin() then raise exception 'Operazione riservata agli amministratori'; end if;
  if p_chiave not in ('soggetto_promotore', 'pec', 'email', 'sito') then
    raise exception 'Informazione non prevista: %', p_chiave;
  end if;
  select valore into v_prima from impostazione where chiave = 'programma_' || p_chiave;
  insert into impostazione (chiave, valore, aggiornato_il) values ('programma_' || p_chiave, coalesce(trim(p_valore), ''), now())
  on conflict (chiave) do update set valore = excluded.valore, aggiornato_il = now();
  insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, stato_precedente, stato_successivo)
  values (auth.uid(), app_ruolo(), 'modifica informazioni del Programma', 'impostazione',
          p_chiave || ': ' || coalesce(v_prima, ''), p_chiave || ': ' || coalesce(trim(p_valore), ''));
end $$;
grant execute on function admin_imposta_info_programma(text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 2. REGISTRI E METODOLOGIE APPROVATE
-- ---------------------------------------------------------------------
-- Registri: piattaforme esterne di scambio dei crediti riconosciute dal
-- Programma (Standard 6: regolamento, interfaccia pubblica, cancellazione
-- tombale; blockchain entro il 1° gennaio 2028).
create table if not exists registro_scambio (
  id uuid primary key default gen_random_uuid(),
  denominazione text not null check (length(trim(denominazione)) >= 2),
  sito_web text,
  regolamento text,
  pec text,
  referente text,
  blockchain boolean not null default false,
  note text,
  attivo boolean not null default true,
  approvato_il date,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
alter table registro_scambio enable row level security;
drop policy if exists registro_select on registro_scambio;
create policy registro_select on registro_scambio for select using (auth.uid() is not null);
drop policy if exists registro_insert on registro_scambio;
create policy registro_insert on registro_scambio for insert with check (app_is_staff());
drop policy if exists registro_update on registro_scambio;
create policy registro_update on registro_scambio for update using (app_is_staff()) with check (app_is_staff());
drop trigger if exists trg_audit on registro_scambio;
create trigger trg_audit after insert or update on registro_scambio
  for each row execute function audit_registra();

-- Metodologie approvate nel Programma (Guida 5). Il documento, se c'è, è
-- un modello pubblico (modello_documento).
create table if not exists metodologia (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) >= 3),
  versione text,
  data_versione date,
  sviluppatore text,
  norma_riferimento text,
  stato text not null default 'approvata' check (stato in ('approvata', 'in revisione', 'ritirata')),
  descrizione text,
  modello_id uuid references modello_documento(id),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
alter table metodologia enable row level security;
drop policy if exists metodologia_select on metodologia;
create policy metodologia_select on metodologia for select using (auth.uid() is not null);
drop policy if exists metodologia_insert on metodologia;
create policy metodologia_insert on metodologia for insert with check (app_is_admin());
drop policy if exists metodologia_update on metodologia;
create policy metodologia_update on metodologia for update using (app_is_admin()) with check (app_is_admin());
drop trigger if exists trg_audit on metodologia;
create trigger trg_audit after insert or update on metodologia
  for each row execute function audit_registra();

insert into metodologia (nome, versione, data_versione, sviluppatore, norma_riferimento, descrizione)
select 'Metodologia Carbon WastePrint®', '1.2', date '2025-09-04',
       'Studio Associato Wastelab e Altraleonia S.r.l.', 'UNI EN ISO 14064-2:2019',
       'Validata da RINA il 16/02/2018 e il 10/02/2020; versione attuale conforme alla UNI EN ISO 14064-2:2019.'
 where not exists (select 1 from metodologia where nome = 'Metodologia Carbon WastePrint®');


-- ---------------------------------------------------------------------
-- 3. MODELLI E DOCUMENTI DEL PROGRAMMA PUBBLICI
-- ---------------------------------------------------------------------
alter table modello_documento add column if not exists pubblico boolean not null default false;
alter table modello_documento add column if not exists categoria text not null default 'modulistica';
alter table modello_documento drop constraint if exists chk_modello_categoria;
alter table modello_documento add constraint chk_modello_categoria
  check (categoria in ('modulistica', 'programma'));


-- ---------------------------------------------------------------------
-- 4. CREDITI EMESSI, REGISTRO E VENDITE
-- ---------------------------------------------------------------------
-- Un lotto = i crediti emessi da un Rapporto di Monitoraggio registrato
-- (di solito uno per Rapporto). Ogni credito ha un ID univoco: codice del
-- lotto + numero progressivo (es. CWP-2026-0001-RM1-L1-000001).
create table if not exists credito_lotto (
  id uuid primary key default gen_random_uuid(),
  codice text unique,
  rapporto_id uuid not null references pratica(id),
  progetto_id uuid not null references pratica(id),
  calcolo_id uuid references calcolo_crediti(id),
  anno_riferimento integer,
  quantita integer not null check (quantita > 0),
  id_primo text,
  id_ultimo text,
  data_emissione date not null default current_date,
  registro_id uuid references registro_scambio(id),
  caricato_il date,
  note text,
  creato_da uuid default auth.uid(),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
alter table credito_lotto enable row level security;
drop policy if exists lotto_select on credito_lotto;
create policy lotto_select on credito_lotto for select using (app_is_staff() or pratica_mia(rapporto_id));

-- Vendite comunicate dal registro (Comunicazione di vendita) e
-- dichiarazione di cancellazione tombale (entro 10 giorni dalla vendita).
create table if not exists credito_vendita (
  id uuid primary key default gen_random_uuid(),
  lotto_id uuid not null references credito_lotto(id),
  pratica_id uuid not null references pratica(id),
  quantita integer not null check (quantita > 0),
  data_vendita date not null,
  beneficiario text not null check (length(trim(beneficiario)) >= 2),
  obiettivo_compensazione text,
  valore_vendita numeric(14,2) check (valore_vendita is null or valore_vendita >= 0),
  id_primo text,
  id_ultimo text,
  comunicazione_documento_id uuid references documento(id),
  cancellazione_documento_id uuid references documento(id),
  cancellato_il date,
  creato_da uuid default auth.uid(),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
alter table credito_vendita enable row level security;
drop policy if exists vendita_select on credito_vendita;
create policy vendita_select on credito_vendita for select using (app_is_staff() or pratica_mia(pratica_id));

drop trigger if exists trg_audit on credito_lotto;
create trigger trg_audit after insert or update on credito_lotto
  for each row execute function audit_registra();
drop trigger if exists trg_audit on credito_vendita;
create trigger trg_audit after insert or update on credito_vendita
  for each row execute function audit_registra();

-- Riepilogo di un lotto: crediti venduti, ritirati (cancellati) e attivi
-- (sul registro e non ancora ritirati). Prima del caricamento sul registro
-- i crediti sono «emessi».
create or replace function cwp_riepilogo_lotto(p_lotto uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'quantita', l.quantita,
    'venduti', coalesce((select sum(quantita) from credito_vendita v where v.lotto_id = l.id), 0),
    'ritirati', coalesce((select sum(quantita) from credito_vendita v where v.lotto_id = l.id and v.cancellato_il is not null), 0),
    'attivi', case when l.registro_id is null then 0
                   else l.quantita - coalesce((select sum(quantita) from credito_vendita v where v.lotto_id = l.id and v.cancellato_il is not null), 0) end,
    'stato', case when l.registro_id is null then 'emessi, da caricare sul registro'
                  when l.quantita = coalesce((select sum(quantita) from credito_vendita v where v.lotto_id = l.id and v.cancellato_il is not null), 0) then 'tutti ritirati'
                  else 'attivi sul registro' end)
  from credito_lotto l where l.id = p_lotto;
$$;

-- ID di un credito: codice del lotto + numero progressivo a 6 cifre.
create or replace function cwp_id_credito(p_codice text, p_n integer)
returns text
language sql immutable as $$
  select p_codice || '-' || lpad(p_n::text, 6, '0');
$$;

-- Emissione dei crediti di un Rapporto (Guida 6.3.2). Solo Amministratori.
-- Il Rapporto deve essere registrato (fase 6 completata); Rapporto e
-- Progetto non sospesi (controllo di qualità, Guida 6.4.2), né annullati,
-- né ritirati. Con un calcolo collegato (ex post confermato dello stesso
-- Rapporto o Progetto) il totale emesso non supera i crediti netti.
create or replace function admin_emetti_crediti(p_rapporto uuid, p_quantita integer, p_calcolo uuid default null, p_note text default null)
returns credito_lotto
language plpgsql security definer set search_path = public as $$
declare r pratica; v_prog pratica; c calcolo_crediti; v_n int; v_gia int; l credito_lotto;
begin
  if not app_is_admin() then raise exception 'L''emissione dei crediti è riservata agli Amministratori'; end if;
  select * into r from pratica where id = p_rapporto;
  if r.id is null or r.tipo <> 'rapporto' then raise exception 'I crediti si emettono da un Rapporto di Monitoraggio'; end if;
  select * into v_prog from pratica where id = r.progetto_padre_id;
  if r.stato in ('sospesa', 'annullata') or v_prog.stato in ('sospesa', 'annullata', 'ritirata') then
    raise exception 'Emissione bloccata: Rapporto o Progetto sospeso, annullato o ritirato (Guida 6.4.1 e 6.4.2)';
  end if;
  if not exists (select 1 from fase where pratica_id = r.id and numero = 6 and stato = 'completata') then
    raise exception 'Il Rapporto non è ancora registrato: serve la seconda verifica documentale completata (fase 6)';
  end if;
  if p_quantita is null or p_quantita <= 0 then raise exception 'Indica il numero di crediti da emettere'; end if;
  if p_calcolo is not null then
    select * into c from calcolo_crediti where id = p_calcolo;
    if c.id is null or c.stato <> 'confermato' or c.tipo <> 'ex_post' or c.pratica_id not in (r.id, v_prog.id) then
      raise exception 'Il calcolo deve essere ex post, confermato e dello stesso Rapporto o Progetto';
    end if;
    select coalesce(sum(quantita), 0) into v_gia from credito_lotto where calcolo_id = c.id;
    if v_gia + p_quantita > floor(coalesce(c.crediti_netti, 0)) then
      raise exception 'Il calcolo % ammette % crediti netti: già emessi %, richiesti %',
        coalesce(c.numero_registro, ''), floor(coalesce(c.crediti_netti, 0)), v_gia, p_quantita;
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('credito_lotto:' || r.id));
  select count(*) + 1 into v_n from credito_lotto where rapporto_id = r.id;
  insert into credito_lotto (codice, rapporto_id, progetto_id, calcolo_id, anno_riferimento, quantita,
                             id_primo, id_ultimo, note)
  values (r.codice || '-L' || v_n, r.id, v_prog.id, p_calcolo, coalesce(c.anno, null), p_quantita,
          cwp_id_credito(r.codice || '-L' || v_n, 1), cwp_id_credito(r.codice || '-L' || v_n, p_quantita),
          nullif(trim(coalesce(p_note, '')), ''))
  returning * into l;
  perform cwp_notifica(array(select cwp_clienti_pratica(r.id)), r.id, 'crediti_emessi',
    'Crediti emessi: ' || p_quantita || ' (' || l.codice || ')', cwp_etichetta_pratica(r.id));
  return l;
end $$;
grant execute on function admin_emetti_crediti(uuid, integer, uuid, text) to authenticated;

-- Caricamento del lotto sul registro scelto dal promotore del progetto
-- (Guida 3.5 e 6.3.3). Staff.
create or replace function staff_carica_su_registro(p_lotto uuid, p_registro uuid, p_data date default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform cwp_richiedi_staff();
  if not exists (select 1 from registro_scambio where id = p_registro and attivo) then
    raise exception 'Registro non trovato o non attivo';
  end if;
  update credito_lotto set registro_id = p_registro, caricato_il = coalesce(p_data, current_date), aggiornato_il = now()
   where id = p_lotto;
  if not found then raise exception 'Lotto non trovato'; end if;
end $$;
grant execute on function staff_carica_su_registro(uuid, uuid, date) to authenticated;

-- Vendita comunicata dal registro (Comunicazione di vendita, Standard 6.2):
-- quantità, beneficiario, obiettivo di compensazione, data, valore. Gli ID
-- dei crediti venduti seguono quelli già venduti. Il documento collegato
-- (della pratica Rapporto) diventa pubblico (Guida, Tabella 5).
create or replace function staff_registra_vendita(p_lotto uuid, p_quantita integer, p_data date, p_beneficiario text,
                                                  p_obiettivo text default null, p_valore numeric default null,
                                                  p_comunicazione uuid default null)
returns credito_vendita
language plpgsql security definer set search_path = public as $$
declare l credito_lotto; v_venduti int; v credito_vendita;
begin
  perform cwp_richiedi_staff();
  select * into l from credito_lotto where id = p_lotto for update;
  if l.id is null then raise exception 'Lotto non trovato'; end if;
  if l.registro_id is null then raise exception 'I crediti vanno prima caricati su un registro'; end if;
  if p_quantita is null or p_quantita <= 0 then raise exception 'Indica il numero di crediti venduti'; end if;
  select coalesce(sum(quantita), 0) into v_venduti from credito_vendita where lotto_id = l.id;
  if v_venduti + p_quantita > l.quantita then
    raise exception 'Restano % crediti da vendere in questo lotto', l.quantita - v_venduti;
  end if;
  if p_data is null or p_data > current_date then raise exception 'Data di vendita non valida'; end if;
  if p_comunicazione is not null and not exists (select 1 from documento where id = p_comunicazione and pratica_id = l.rapporto_id) then
    raise exception 'Il documento deve essere della pratica del Rapporto';
  end if;
  insert into credito_vendita (lotto_id, pratica_id, quantita, data_vendita, beneficiario, obiettivo_compensazione,
                               valore_vendita, id_primo, id_ultimo, comunicazione_documento_id)
  values (l.id, l.rapporto_id, p_quantita, p_data, trim(p_beneficiario), nullif(trim(coalesce(p_obiettivo, '')), ''),
          p_valore, cwp_id_credito(l.codice, v_venduti + 1), cwp_id_credito(l.codice, v_venduti + p_quantita), p_comunicazione)
  returning * into v;
  if p_comunicazione is not null then
    update documento set pubblico = true where id = p_comunicazione and not pubblico;
  end if;
  return v;
end $$;
grant execute on function staff_registra_vendita(uuid, integer, date, text, text, numeric, uuid) to authenticated;

-- Dichiarazione di cancellazione tombale dei crediti venduti: i crediti
-- passano a «ritirato». Il documento diventa pubblico.
create or replace function staff_registra_cancellazione(p_vendita uuid, p_documento uuid, p_data date default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v credito_vendita;
begin
  perform cwp_richiedi_staff();
  select * into v from credito_vendita where id = p_vendita;
  if v.id is null then raise exception 'Vendita non trovata'; end if;
  if v.cancellato_il is not null then raise exception 'Cancellazione già registrata'; end if;
  if p_documento is null or not exists (select 1 from documento where id = p_documento and pratica_id = v.pratica_id) then
    raise exception 'Serve la Dichiarazione di cancellazione tombale caricata nella pratica del Rapporto';
  end if;
  update credito_vendita set cancellazione_documento_id = p_documento, cancellato_il = coalesce(p_data, current_date),
                             aggiornato_il = now()
   where id = p_vendita;
  update documento set pubblico = true where id = p_documento and not pubblico;
end $$;
grant execute on function staff_registra_cancellazione(uuid, uuid, date) to authenticated;

-- Avviso allo staff: vendita senza dichiarazione di cancellazione dopo 10
-- giorni (Guida 6.3.3). Si aggiunge al lavoro giornaliero delle scadenze.
create or replace function genera_avvisi_crediti()
returns integer
language plpgsql security definer set search_path = public as $$
declare v record; v_n int := 0;
begin
  for v in
    select cv.*, l.codice from credito_vendita cv join credito_lotto l on l.id = cv.lotto_id
     where cv.cancellato_il is null and cv.data_vendita < current_date - 10
  loop
    if not exists (select 1 from notifica where chiave = 'cancellazione_mancante:' || v.id) then
      insert into notifica (utente_id, pratica_id, evento, titolo, testo, chiave)
      select d, v.pratica_id, 'cancellazione_mancante',
             'Manca la dichiarazione di cancellazione dei crediti venduti',
             v.codice || ' — ' || v.quantita || ' crediti venduti il ' || to_char(v.data_vendita, 'DD/MM/YYYY')
               || ': il registro doveva inviarla entro 10 giorni (Guida 6.3.3)',
             'cancellazione_mancante:' || v.id
        from unnest(array(select cwp_staff())) d;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cwp_avvisi_crediti';
    perform cron.schedule('cwp_avvisi_crediti', '15 6 * * *', 'select public.genera_avvisi_crediti()');
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 5. RECLAMI E RICHIESTE DI CHIARIMENTO (Politica di reclamo)
-- ---------------------------------------------------------------------
create table if not exists reclamo (
  id uuid primary key default gen_random_uuid(),
  codice text unique,
  tipo text not null default 'reclamo' check (tipo in ('reclamo', 'chiarimento')),
  canale text not null default 'pec' check (canale in ('pec', 'portale', 'email', 'altro')),
  ricevuto_il date not null default current_date,
  mittente_nome text not null check (length(trim(mittente_nome)) >= 2),
  mittente_organizzazione text,
  mittente_ruolo text not null default 'stakeholder'
    check (mittente_ruolo in ('promotore del progetto', 'ente di validazione e verifica',
                              'sviluppatore di metodologia', 'registro', 'stakeholder')),
  mittente_contatti text,
  pratica_id uuid references pratica(id),
  oggetto text not null check (length(trim(oggetto)) >= 3),
  dettagli text not null check (length(trim(dettagli)) >= 10),
  conflitto_interessi text,
  stato text not null default 'ricevuto' check (stato in ('ricevuto', 'in esame', 'risposto', 'chiuso')),
  gestore_id uuid references profilo(id),
  conferma_inviata_il date,
  risposta text,
  risposto_il date,
  costi numeric(12,2) check (costi is null or costi >= 0),
  note_interne text,
  creato_da uuid default auth.uid(),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
alter table reclamo enable row level security;
-- Lo staff vede e gestisce tutto; chi scrive dal portale legge i propri
-- (con la funzione miei_reclami, senza le note interne).
drop policy if exists reclamo_staff on reclamo;
create policy reclamo_staff on reclamo for select using (app_is_staff());
drop policy if exists reclamo_insert on reclamo;
create policy reclamo_insert on reclamo for insert with check (app_is_staff());
drop policy if exists reclamo_update on reclamo;
create policy reclamo_update on reclamo for update using (app_is_staff()) with check (app_is_staff());
drop trigger if exists trg_audit on reclamo;
create trigger trg_audit after insert or update on reclamo
  for each row execute function audit_registra();

-- Codice REC-AAAA-NNN (CHI-AAAA-NNN per i chiarimenti).
create or replace function reclamo_codice()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pref text; v_n int;
begin
  if new.codice is null then
    v_pref := case new.tipo when 'chiarimento' then 'CHI' else 'REC' end || '-' || extract(year from new.ricevuto_il)::int || '-';
    perform pg_advisory_xact_lock(hashtext('reclamo:' || v_pref));
    select coalesce(max(substring(codice from length(v_pref) + 1)::int), 0) + 1 into v_n
      from reclamo where codice like v_pref || '%';
    new.codice := v_pref || lpad(v_n::text, 3, '0');
  end if;
  new.aggiornato_il := now();
  if new.risposta is not null and length(trim(new.risposta)) > 0 and new.risposto_il is null then
    new.risposto_il := current_date;
  end if;
  return new;
end $$;
drop trigger if exists trg_reclamo_codice on reclamo;
create trigger trg_reclamo_codice before insert or update on reclamo
  for each row execute function reclamo_codice();

-- Notifiche: allo staff per ogni nuovo reclamo; all'autore (se l'ha
-- scritto dal portale) quando arriva la risposta.
create or replace function reclamo_notifiche()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform cwp_notifica(array(select cwp_staff()), new.pratica_id, 'nuovo_reclamo',
      case new.tipo when 'chiarimento' then 'Nuova richiesta di chiarimento ' else 'Nuovo reclamo ' end || new.codice,
      new.oggetto);
  elsif new.risposta is distinct from old.risposta and new.risposta is not null and new.creato_da is not null
        and exists (select 1 from profilo where id = new.creato_da and ruolo = 'cliente') then
    perform cwp_notifica(array[new.creato_da], new.pratica_id, 'risposta_reclamo',
      'Risposta a ' || new.codice, new.oggetto);
  end if;
  return null;
end $$;
drop trigger if exists trg_reclamo_notifiche on reclamo;
create trigger trg_reclamo_notifiche after insert or update on reclamo
  for each row execute function reclamo_notifiche();

-- Il Cliente invia un reclamo o una richiesta di chiarimento dal portale.
create or replace function invia_reclamo(p_tipo text, p_oggetto text, p_dettagli text,
                                         p_pratica uuid default null, p_conflitto text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare v_prof profilo; v_codice text; v_org text;
begin
  select * into v_prof from profilo where id = auth.uid() and attivo and not password_temporanea;
  if v_prof.id is null then raise exception 'Accesso richiesto'; end if;
  if p_pratica is not null and not pratica_mia(p_pratica) then raise exception 'Pratica non trovata'; end if;
  select denominazione into v_org from organizzazione where id = v_prof.organizzazione_id;
  insert into reclamo (tipo, canale, mittente_nome, mittente_organizzazione, mittente_ruolo, mittente_contatti,
                       pratica_id, oggetto, dettagli, conflitto_interessi, creato_da)
  values (coalesce(p_tipo, 'reclamo'), 'portale', coalesce(v_prof.nome_completo, 'Utente del portale'), v_org,
          case when v_prof.ruolo = 'cliente' then 'promotore del progetto' else 'stakeholder' end,
          (select email from auth.users where id = auth.uid()),
          p_pratica, trim(p_oggetto), trim(p_dettagli), nullif(trim(coalesce(p_conflitto, '')), ''), auth.uid())
  returning codice into v_codice;
  return v_codice;
end $$;
grant execute on function invia_reclamo(text, text, text, uuid, text) to authenticated;

-- I reclami inviati dall'utente, senza le note interne.
create or replace function miei_reclami()
returns table (codice text, tipo text, ricevuto_il date, oggetto text, dettagli text, stato text,
               risposta text, risposto_il date, costi numeric)
language sql stable security definer set search_path = public as $$
  select codice, tipo, ricevuto_il, oggetto, dettagli, stato, risposta, risposto_il, costi
    from reclamo where creato_da = auth.uid() order by creato_il desc;
$$;
grant execute on function miei_reclami() to authenticated;


-- ---------------------------------------------------------------------
-- 6. DATI PUBBLICI DELLA PIATTAFORMA (Guida 3.7)
-- ---------------------------------------------------------------------
-- Tutto ciò che la pagina pubblica /programma mostra, in un solo JSON:
-- informazioni del Programma, enti di validazione e verifica attivi,
-- registri attivi, metodologie, documenti del Programma e modulistica
-- pubblici, Progetti dal momento in cui sono «in fase di validazione»
-- (Guida 6.2.1; i ritirati restano pubblici, Guida 6.4.1) con i loro
-- documenti pubblici, i Rapporti e i crediti emessi. Nessun dato
-- personale, nessun percorso dei file (si scaricano con un id).
-- La chiama solo la Edge Function consultazione-pubblica con la chiave di
-- servizio: niente permessi per anon e authenticated.
create or replace function pubblico_programma()
returns jsonb
language sql stable security definer set search_path = public as $$
  with prog as (
    select p.*, cwp_stato_programma(p.id) as stato_prog
      from pratica p
     where p.tipo = 'progetto' and p.stato <> 'annullata'
  )
  select jsonb_build_object(
    'info', info_programma(),
    'enti', coalesce((select jsonb_agg(jsonb_build_object('denominazione', denominazione, 'accreditamento', accreditamento) order by denominazione)
                        from ente_validazione where attivo), '[]'::jsonb),
    'registri', coalesce((select jsonb_agg(jsonb_build_object('denominazione', denominazione, 'sito_web', sito_web,
                                                              'regolamento', regolamento, 'blockchain', blockchain,
                                                              'approvato_il', approvato_il) order by denominazione)
                            from registro_scambio where attivo), '[]'::jsonb),
    'metodologie', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'versione', versione, 'data_versione', data_versione,
                                                                 'sviluppatore', sviluppatore, 'norma', norma_riferimento,
                                                                 'stato', stato, 'descrizione', descrizione, 'modello_id', modello_id)
                                              order by nome) from metodologia where stato <> 'ritirata'), '[]'::jsonb),
    'documenti', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'titolo', titolo, 'descrizione', descrizione,
                                                               'categoria', categoria, 'nome_file', nome_file) order by categoria desc, nome_file, titolo)
                             from modello_documento where attivo and pubblico), '[]'::jsonb),
    'progetti', coalesce((select jsonb_agg(jsonb_build_object(
        'codice', pr.codice, 'titolo', pr.titolo,
        'promotore', (select denominazione from organizzazione where id = pr.organizzazione_id),
        'copromotori', pr.copromotori, 'territorio', pr.codici_istat,
        'periodo', pr.periodo_riferimento, 'stato', pr.stato_prog,
        'data_registrazione', pr.data_registrazione,
        'documenti', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nome', d.nome, 'tipologia', d.tipologia,
                                                                   'versione', d.versione, 'data', d.creato_il::date) order by d.creato_il)
                                 from documento d where d.pratica_id = pr.id and d.pubblico and d.corrente), '[]'::jsonb),
        'rapporti', coalesce((select jsonb_agg(jsonb_build_object(
            'codice', r.codice, 'anno', r.anno_monitoraggio, 'stato', cwp_stato_programma(r.id),
            'documenti', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nome', d.nome, 'tipologia', d.tipologia,
                                                                       'versione', d.versione, 'data', d.creato_il::date) order by d.creato_il)
                                     from documento d where d.pratica_id = r.id and d.pubblico and d.corrente), '[]'::jsonb),
            'crediti', coalesce((select jsonb_agg(jsonb_build_object(
                'codice', l.codice, 'quantita', l.quantita, 'id_primo', l.id_primo, 'id_ultimo', l.id_ultimo,
                'data_emissione', l.data_emissione,
                'registro', (select denominazione from registro_scambio where id = l.registro_id),
                'riepilogo', cwp_riepilogo_lotto(l.id)) order by l.codice)
              from credito_lotto l where l.rapporto_id = r.id), '[]'::jsonb)
          ) order by r.anno_monitoraggio)
          from pratica r where r.progetto_padre_id = pr.id and r.tipo = 'rapporto' and r.stato <> 'annullata'
            and cwp_stato_programma(r.id) not like 'richiesta%'), '[]'::jsonb)
      ) order by pr.codice)
      from prog pr where pr.stato_prog not like 'richiesta%' and pr.stato_prog not like 'non registrato%'), '[]'::jsonb)
  );
$$;
revoke all on function pubblico_programma() from public, anon, authenticated;

-- Un documento o un modello si può scaricare dalla pagina pubblica solo se
-- è pubblico (e, per i documenti, corrente e di una pratica pubblicata).
create or replace function pubblico_percorso_file(p_tipo text, p_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select case p_tipo
    when 'modello' then (select storage_path from modello_documento where id = p_id and attivo and pubblico)
    when 'documento' then (select d.storage_path from documento d join pratica p on p.id = d.pratica_id
                            where d.id = p_id and d.pubblico and d.corrente and p.stato <> 'annullata'
                              and not cwp_tipologia_riservata(d.tipologia))
  end;
$$;
revoke all on function pubblico_percorso_file(text, uuid) from public, anon, authenticated;
