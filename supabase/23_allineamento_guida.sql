-- =====================================================================
--  ALLINEAMENTO AI DOCUMENTI UFFICIALI DEL PROGRAMMA (18/10/2026)
--  Eseguire DOPO 22_stato_ritirata.sql (in un'esecuzione separata).
--  Lo script è rieseguibile.
--  Registro sviluppo e deploy: capitolo «Database», cronologia del 18/10.
--
--  Fonti: Guida al Programma, Standard CWP, Schema tariffario (v1.2 del
--  04/09/2025). Decisione di Luca del 18/10: allineare il portale ai
--  documenti in tutti i punti emersi dalla rilettura.
--
--   1. Rapporto di Monitoraggio con le stesse 7 fasi del Progetto (Guida
--      6.3.1 e Tabella 4): feedback pubblico di 20 giorni, risposta in 15,
--      verifica dell'ente in 60, seconda verifica documentale in 10. Il
--      feedback pubblico vale anche per i Rapporti e dura quanto la fase 3.
--   2. Conservazione per 12 anni (Guida 6.2.1 e 6.5.1).
--   3. Periodo di riferimento del Progetto: 10 anni oppure 7 anni
--      rinnovabili 3 volte (Standard 4.3.8): fino a 10 o fino a 21
--      Rapporti. Nessun Rapporto per un Progetto ritirato o annullato.
--   4. Un solo account per Organizzazione, quello del rappresentante
--      autorizzato, e fino a 2 delegati (Guida 7.2).
--   5. Stati del Programma (Guida, Tabelle 3 e 4) e data di
--      registrazione del Progetto (Standard 4.5).
--   6. Ritiro e rientro del Progetto (Guida 6.4.1).
--   7. Un solo progetto per territorio: codici ISTAT (Standard 4.6,
--      Guida 6.2.1). Soggetti co-promotori (Guida 3.3.1).
--   8. Avviso allo staff dopo 2 anni senza Rapporti (Guida 6.4.1).
--   9. Documenti richiesti dalla Guida per ogni fase; contratto con
--      l'ente e versione privata del Modulo di descrizione mai pubblici
--      (Guida 7.1 e 7.3).
--  10. Tariffe (Schema tariffario): voce del pagamento, popolazione e
--      crediti previsti; attività sospese fino al saldo delle fatture
--      scadute; l'iscrizione va saldata prima della validazione.
--  11. Verifica documentale sull'accuratezza (+15 giorni) e fino a 3
--      accertamenti (+10 giorni ciascuno) nelle fasi 2 e 6 (Guida 6.5.2).
--  12. Notifiche ridefinite (feedback pubblico, ritiro).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. RAPPORTO DI MONITORAGGIO A 7 FASI E FEEDBACK PUBBLICO
-- ---------------------------------------------------------------------
create or replace function cwp_numero_fasi(p_tipo tipo_pratica)
returns int
language sql immutable as $$
  -- Progetto e Rapporto hanno lo stesso percorso di 7 fasi (Guida 6.3.1).
  select 7;
$$;

do $$
begin
  -- Il passaggio da 4 a 7 fasi si fa una sola volta: la vecchia struttura
  -- si riconosce dalla fase 4 «Chiusura» del Rapporto.
  if exists (select 1 from durata_fase where tipo_pratica = 'rapporto' and numero = 4 and nome = 'Chiusura') then
    delete from durata_fase where tipo_pratica = 'rapporto';

    -- Rapporti già creati con 4 fasi: 3 → 5 (verifica), 4 → 7 (chiusura);
    -- le fasi nuove 3, 4 e 6 si aggiungono «non iniziate», oppure
    -- «completate» con una nota se il percorso è già andato oltre.
    update fase f set numero = 7, nome = 'Chiusura'
      from pratica p where p.id = f.pratica_id and p.tipo = 'rapporto' and f.numero = 4;
    update fase f set numero = 5, nome = 'Verifica del rapporto'
      from pratica p where p.id = f.pratica_id and p.tipo = 'rapporto' and f.numero = 3;
    update fase f set nome = 'Registrazione del rapporto'
      from pratica p where p.id = f.pratica_id and p.tipo = 'rapporto' and f.numero = 1;
    update fase f set nome = 'Prima verifica documentale'
      from pratica p where p.id = f.pratica_id and p.tipo = 'rapporto' and f.numero = 2;

    insert into fase (pratica_id, numero, nome, responsabile, stato, note)
    select p.id, n.numero, n.nome, n.responsabile,
           case when exists (select 1 from fase x where x.pratica_id = p.id and x.numero > n.numero
                               and x.stato <> 'non_iniziata')
                then 'completata'::stato_fase else 'non_iniziata'::stato_fase end,
           case when exists (select 1 from fase x where x.pratica_id = p.id and x.numero > n.numero
                               and x.stato <> 'non_iniziata')
                then 'Fase aggiunta il 18/10/2026 con l''allineamento alla Guida al Programma: non svolta per questo Rapporto.' end
      from pratica p
      cross join (values (3, 'Feedback pubblico', 'Soggetto Promotore'),
                         (4, 'Risposta ai commenti', 'Soggetto Promotore'),
                         (6, 'Seconda verifica documentale', 'Soggetto Promotore')) n(numero, nome, responsabile)
     where p.tipo = 'rapporto'
       and not exists (select 1 from fase x where x.pratica_id = p.id and x.numero = n.numero);

    -- Documenti richiesti e modelli già configurati per il Rapporto.
    update documento_richiesto set fase_numero = 7 where tipo_pratica = 'rapporto' and fase_numero = 4;
    update documento_richiesto set fase_numero = 5 where tipo_pratica = 'rapporto' and fase_numero = 3;
    update modello_documento set fase_numero = 7 where tipo_pratica = 'rapporto' and fase_numero = 4;
    update modello_documento set fase_numero = 5 where tipo_pratica = 'rapporto' and fase_numero = 3;
  end if;
end $$;

-- Durate del Rapporto (Guida, Tabella 4). Rieseguendo lo script non si
-- toccano le durate modificate dall'Amministratore.
insert into durata_fase (tipo_pratica, numero, nome, giorni) values
  ('rapporto', 1, 'Registrazione del rapporto', 0),
  ('rapporto', 2, 'Prima verifica documentale', 10),
  ('rapporto', 3, 'Feedback pubblico', 20),
  ('rapporto', 4, 'Risposta ai commenti', 15),
  ('rapporto', 5, 'Verifica del rapporto', 60),
  ('rapporto', 6, 'Seconda verifica documentale', 10),
  ('rapporto', 7, 'Chiusura', 0)
on conflict (tipo_pratica, numero) do nothing;

-- Termine ufficiale «feedback pubblico» (Guida 3.9) anche per il Progetto.
update durata_fase set nome = 'Feedback pubblico'
 where tipo_pratica = 'progetto' and numero = 3 and nome = 'Consultazione pubblica';
update fase f set nome = 'Feedback pubblico'
  from pratica p where p.id = f.pratica_id and p.tipo = 'progetto' and f.numero = 3
   and f.nome = 'Consultazione pubblica';

-- Responsabili delle fasi con i nomi della Guida: la Fondazione è il
-- «promotore del programma», il Comune il «promotore del progetto».
update fase set responsabile = case numero
    when 1 then 'Promotore del progetto' when 4 then 'Promotore del progetto'
    when 5 then 'Ente di validazione e verifica' else 'Promotore del programma' end
 where responsabile in ('Soggetto Promotore', 'Ente di Validazione');

-- Giorni del feedback pubblico per un tipo di pratica: durata della fase 3
-- (30 per il Progetto, 20 per il Rapporto, modificabili dall'Admin).
create or replace function cwp_giorni_feedback(p_tipo tipo_pratica)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(cwp_durata_fase(p_tipo, 3), 0),
                  case p_tipo when 'rapporto' then 20 else 30 end);
$$;

-- Apertura del feedback pubblico: ora anche per i Rapporti.
create or replace function staff_apri_consultazione(p_pratica uuid, p_documento uuid)
returns consultazione
language plpgsql security definer set search_path = public as $$
declare p pratica; c consultazione;
begin
  perform cwp_richiedi_staff();
  select * into p from pratica where id = p_pratica;
  if p.id is null then raise exception 'Pratica non trovata'; end if;
  if p.stato <> 'attiva' then
    raise exception 'La pratica non è attiva';
  end if;
  if exists (select 1 from consultazione where pratica_id = p_pratica and attiva) then
    raise exception 'C''è già un feedback pubblico aperto per questa pratica';
  end if;
  if not exists (select 1 from documento where id = p_documento and pratica_id = p_pratica) then
    raise exception 'Il documento non appartiene a questa pratica';
  end if;

  update documento set pubblico = true where id = p_documento and not pubblico;
  insert into consultazione (pratica_id, documento_id, data_apertura, data_chiusura, attiva)
  values (p_pratica, p_documento, current_date, current_date + cwp_giorni_feedback(p.tipo), true)
  returning * into c;
  return c;
end $$;

-- Errata corrige con ripartenza: riparte con la durata del tipo di pratica.
create or replace function staff_errata_corrige(p_consultazione uuid, p_documento uuid, p_testo text,
                                                p_riparte boolean, p_motivazione text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare c consultazione; v_id uuid; v_nuova date; v_tipo tipo_pratica;
begin
  perform cwp_richiedi_staff();
  select * into c from consultazione where id = p_consultazione;
  if c.id is null then raise exception 'Feedback pubblico non trovato'; end if;
  if not c.attiva then raise exception 'Il feedback pubblico è chiuso'; end if;
  if p_testo is null or length(trim(p_testo)) < 3 then
    raise exception 'Descrivi la correzione';
  end if;
  if p_documento is not null and not exists (
      select 1 from documento where id = p_documento and pratica_id = c.pratica_id) then
    raise exception 'Il documento non appartiene a questa pratica';
  end if;
  select tipo into v_tipo from pratica where id = c.pratica_id;
  if coalesce(p_riparte, false) then
    perform cwp_richiedi_motivazione(p_motivazione);
    v_nuova := current_date + cwp_giorni_feedback(v_tipo);
    update consultazione set data_chiusura = v_nuova where id = c.id;
  elsif p_motivazione is not null and length(trim(p_motivazione)) > 0 then
    perform set_config('cwp.motivazione', trim(p_motivazione), true);
  end if;
  insert into consultazione_errata (consultazione_id, pratica_id, documento_id, testo, riparte,
                                    chiusura_precedente, nuova_chiusura, motivazione, creato_da)
  values (c.id, c.pratica_id, p_documento, trim(p_testo), coalesce(p_riparte, false),
          c.data_chiusura, coalesce(v_nuova, c.data_chiusura), nullif(trim(coalesce(p_motivazione, '')), ''), auth.uid())
  returning id into v_id;
  if p_documento is not null then
    update documento set pubblico = true where id = p_documento and not pubblico;
  end if;
  return v_id;
end $$;


-- ---------------------------------------------------------------------
-- 2. CONSERVAZIONE PER 12 ANNI
-- ---------------------------------------------------------------------
-- Guida 6.2.1 (12 anni dalla richiesta di adesione) e 6.5.1 (12 anni
-- dalla conclusione della verifica documentale): si prende il termine più
-- lungo, 12 anni dalla chiusura, dall'annullamento o dal ritiro.
create or replace function pratica_conservazione()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stato in ('chiusa', 'annullata', 'ritirata') and old.stato not in ('chiusa', 'annullata', 'ritirata') then
    new.conservare_fino_al := (current_date + interval '12 years')::date;
  elsif new.stato in ('attiva', 'sospesa') then
    new.conservare_fino_al := null;
  end if;
  return new;
end $$;

-- Date già calcolate con i 10 anni: +2 anni (una sola volta).
do $$
begin
  if not exists (select 1 from impostazione where chiave = 'conservazione_12_anni') then
    update pratica set conservare_fino_al = (conservare_fino_al + interval '2 years')::date
     where conservare_fino_al is not null;
    insert into impostazione (chiave, valore) values ('conservazione_12_anni', 'applicata il ' || current_date);
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. PERIODO DI RIFERIMENTO E NUMERO DI RAPPORTI
-- ---------------------------------------------------------------------
alter table pratica add column if not exists periodo_riferimento text not null default '10 anni';
alter table pratica drop constraint if exists chk_periodo_riferimento;
alter table pratica add constraint chk_periodo_riferimento
  check (periodo_riferimento in ('10 anni', '7 anni rinnovabili'));

-- Fino a 21 Rapporti (7 anni per 3 volte); il limite effettivo dipende
-- dal periodo del Progetto ed è controllato da rapporto_coerente().
alter table pratica drop constraint if exists chk_anno_range;
alter table pratica add constraint chk_anno_range
  check (anno_monitoraggio is null or anno_monitoraggio between 1 and 21);

-- Massimo numero di Rapporti di un periodo.
create or replace function cwp_massimo_rapporti(p_periodo text)
returns int
language sql immutable as $$
  select case p_periodo when '7 anni rinnovabili' then 21 else 10 end;
$$;

create or replace function rapporto_coerente()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_padre pratica;
begin
  if new.tipo <> 'rapporto' then return new; end if;
  select * into v_padre from pratica where id = new.progetto_padre_id;
  if v_padre.tipo is distinct from 'progetto' then
    raise exception 'Un Rapporto di Monitoraggio deve essere collegato a un Progetto';
  end if;
  if v_padre.stato in ('annullata', 'ritirata') then
    raise exception 'Il Progetto è %: non si possono presentare Rapporti di Monitoraggio',
      case v_padre.stato when 'ritirata' then 'ritirato' else 'annullato' end;
  end if;
  if new.anno_monitoraggio > cwp_massimo_rapporti(v_padre.periodo_riferimento) then
    raise exception 'Con il periodo di riferimento «%» il Progetto ha al massimo % Rapporti',
      v_padre.periodo_riferimento, cwp_massimo_rapporti(v_padre.periodo_riferimento);
  end if;
  new.organizzazione_id := v_padre.organizzazione_id;
  new.periodo_riferimento := v_padre.periodo_riferimento;
  if new.anno_monitoraggio > 1 and not exists (
    select 1 from pratica where progetto_padre_id = new.progetto_padre_id
      and tipo = 'rapporto' and anno_monitoraggio = new.anno_monitoraggio - 1) then
    raise exception 'Il Rapporto dell''anno % richiede prima quello dell''anno %',
      new.anno_monitoraggio, new.anno_monitoraggio - 1;
  end if;
  return new;
end $$;


-- ---------------------------------------------------------------------
-- 4. UN SOLO ACCOUNT PER ORGANIZZAZIONE E FINO A 2 DELEGATI
-- ---------------------------------------------------------------------
-- Guida 7.2: fino a 2 persone con delega di rappresentanza, di cui una
-- sola con un account sulla piattaforma. Per cambiare rappresentante si
-- disattiva l'account attuale e se ne crea uno nuovo.
alter table organizzazione add column if not exists delegati text[] not null default '{}';
alter table organizzazione drop constraint if exists chk_delegati;
alter table organizzazione add constraint chk_delegati check (cardinality(delegati) <= 2);

-- Controlla che l'utente, se è un Cliente attivo, sia l'unico account
-- attivo di ognuna delle sue Organizzazioni.
create or replace function cwp_controlla_account_unico(p_utente uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_org record;
begin
  if not exists (select 1 from profilo where id = p_utente and ruolo = 'cliente' and attivo) then
    return;
  end if;
  for v_org in
    select o.id, o.denominazione from organizzazione o
     where o.id in (select organizzazione_id from profilo where id = p_utente
                    union select organizzazione_id from utente_organizzazione where utente_id = p_utente)
  loop
    if exists (
      select 1 from profilo p
       where p.id <> p_utente and p.ruolo = 'cliente' and p.attivo
         and (p.organizzazione_id = v_org.id
              or exists (select 1 from utente_organizzazione uo
                          where uo.utente_id = p.id and uo.organizzazione_id = v_org.id))) then
      raise exception 'L''Organizzazione «%» ha già un account attivo: per la Guida al Programma (cap. 7.2) solo il rappresentante autorizzato ha un account. Disattiva quello attuale prima di attivarne un altro.', v_org.denominazione;
    end if;
  end loop;
end $$;

create or replace function account_unico_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'utente_organizzazione' then
    perform cwp_controlla_account_unico(new.utente_id);
  else
    perform cwp_controlla_account_unico(new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_account_unico on utente_organizzazione;
create trigger trg_account_unico after insert or update on utente_organizzazione
  for each row execute function account_unico_trigger();
drop trigger if exists trg_account_unico on profilo;
create trigger trg_account_unico after update of attivo, ruolo, organizzazione_id on profilo
  for each row execute function account_unico_trigger();


-- ---------------------------------------------------------------------
-- 5. STATI DEL PROGRAMMA E DATA DI REGISTRAZIONE
-- ---------------------------------------------------------------------
-- Data di registrazione del Progetto (Standard 4.5: è la data di inizio):
-- la chiusura della fase 6 (seconda verifica documentale) con esito
-- positivo. Per il Rapporto è la data di registrazione dei crediti.
alter table pratica add column if not exists data_registrazione date;

create or replace function fase_registrazione()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero = 6 and new.stato = 'completata' and old.stato is distinct from 'completata' then
    update pratica set data_registrazione = coalesce(data_registrazione, new.data_effettiva_chiusura, current_date)
     where id = new.pratica_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_fase_registrazione on fase;
create trigger trg_fase_registrazione after update of stato on fase
  for each row execute function fase_registrazione();

-- Stato della pratica nel Programma, con i nomi della Guida (Tabelle 3 e
-- 4). Lo stesso calcolo è in src/lib/cwpProgram.js (statoProgramma).
create or replace function cwp_stato_programma(p_pratica uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare p pratica; v_ultima int;
begin
  select * into p from pratica where id = p_pratica;
  if p.id is null then return null; end if;
  if p.stato = 'ritirata' then return 'progetto ritirato'; end if;
  if p.stato = 'annullata' then return 'non registrato (pratica annullata)'; end if;
  -- Ultima fase completata «di passaggio»: 6, 5 o 2.
  select max(numero) into v_ultima from fase
   where pratica_id = p_pratica and stato = 'completata' and numero in (2, 5, 6);
  if v_ultima = 6 then
    return case p.tipo when 'rapporto' then 'rapporto registrato e crediti registrati' else 'progetto registrato' end;
  elsif v_ultima = 5 then
    return 'in fase di verifica documentale';
  elsif v_ultima = 2 then
    return 'in fase di validazione';
  end if;
  return case p.tipo when 'rapporto' then 'richiesta di registrazione del rapporto' else 'richiesta di registrazione' end;
end $$;


-- ---------------------------------------------------------------------
-- 6. RITIRO E RIENTRO DEL PROGETTO
-- ---------------------------------------------------------------------
-- Il ritiro (stato «ritirata») riguarda solo i Progetti, su lettera del
-- soggetto promotore del progetto: la motivazione ne riporta gli estremi.
-- Da «ritirata» si torna solo ad «attiva» (rientro nel Programma).
create or replace function staff_cambia_stato_pratica(p_pratica uuid, p_stato stato_pratica, p_motivazione text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_mot text; v_attuale stato_pratica; v_tipo tipo_pratica;
begin
  perform cwp_richiedi_staff();
  v_mot := cwp_richiedi_motivazione(p_motivazione);
  select stato, tipo into v_attuale, v_tipo from pratica where id = p_pratica;
  if v_attuale is null then raise exception 'Pratica non trovata'; end if;
  if v_attuale = p_stato then raise exception 'La pratica è già in questo stato'; end if;
  if v_attuale = 'annullata' then
    raise exception 'Una pratica annullata non può cambiare stato';
  end if;
  if p_stato = 'ritirata' and v_tipo <> 'progetto' then
    raise exception 'Si ritira un Progetto, non un singolo Rapporto (Guida 6.4.1)';
  end if;
  if v_attuale = 'ritirata' and p_stato <> 'attiva' then
    raise exception 'Un Progetto ritirato può solo rientrare nel Programma (stato «attiva»)';
  end if;
  update pratica
     set stato = p_stato, motivazione_stato = v_mot, aggiornato_il = now()
   where id = p_pratica;
end $$;


-- ---------------------------------------------------------------------
-- 7. TERRITORIO (CODICI ISTAT), CO-PROMOTORI E DATI DEL PROGETTO
-- ---------------------------------------------------------------------
alter table pratica add column if not exists codici_istat text[] not null default '{}';
alter table pratica add column if not exists copromotori text[] not null default '{}';
-- Dati per le tariffe (Schema tariffario): popolazione residente nel
-- territorio e crediti previsti (dal Progetto nel periodo, dal Rapporto
-- nell'anno).
alter table pratica add column if not exists popolazione integer;
alter table pratica add column if not exists crediti_previsti integer;
alter table pratica drop constraint if exists chk_popolazione;
alter table pratica add constraint chk_popolazione check (popolazione is null or popolazione >= 0);
alter table pratica drop constraint if exists chk_crediti_previsti;
alter table pratica add constraint chk_crediti_previsti check (crediti_previsti is null or crediti_previsti >= 0);

-- Ogni codice ISTAT di un Comune ha 6 cifre.
create or replace function cwp_codici_istat_validi(p text[])
returns boolean
language sql immutable as $$
  select coalesce(bool_and(c ~ '^[0-9]{6}$'), true) from unnest(p) c;
$$;
alter table pratica drop constraint if exists chk_codici_istat;
alter table pratica add constraint chk_codici_istat check (cwp_codici_istat_validi(codici_istat));

-- Un territorio (Comune) può stare in un solo Progetto non annullato né
-- ritirato (Standard 4.6). I codici sono ordinati e senza doppioni.
create or replace function pratica_territorio()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_altro text; v_codice text;
begin
  new.codici_istat := coalesce(array(select distinct trim(c) from unnest(new.codici_istat) c
                                      where trim(c) <> '' order by 1), '{}');
  if not cwp_codici_istat_validi(new.codici_istat) then
    raise exception 'Codice ISTAT non valido: ogni Comune ha un codice di 6 cifre (es. 041044)';
  end if;
  if new.tipo <> 'progetto' or new.stato in ('annullata', 'ritirata') or cardinality(new.codici_istat) = 0 then
    return new;
  end if;
  select o.codice, c into v_altro, v_codice
    from pratica o, unnest(o.codici_istat) c
   where o.id <> new.id and o.tipo = 'progetto' and o.stato not in ('annullata', 'ritirata')
     and c = any (new.codici_istat)
   limit 1;
  if v_altro is not null then
    raise exception 'Il territorio con codice ISTAT % è già nel Progetto % (un solo progetto per territorio, Standard 4.6)',
      v_codice, v_altro;
  end if;
  return new;
end $$;

drop trigger if exists trg_pratica_territorio on pratica;
create trigger trg_pratica_territorio before insert or update of codici_istat, stato on pratica
  for each row execute function pratica_territorio();

-- Creazione della pratica: anche i nuovi dati del Progetto.
create or replace function staff_crea_pratica(p_pratica jsonb, p_fasi jsonb)
returns pratica
language plpgsql set search_path = public as $$
declare
  v_pratica pratica;
  v_tipo tipo_pratica := (p_pratica ->> 'tipo')::tipo_pratica;
begin
  if not app_is_staff() then
    raise exception 'Solo Operatori e Amministratori creano le pratiche';
  end if;
  if jsonb_typeof(p_fasi) <> 'array' or jsonb_array_length(p_fasi) <> cwp_numero_fasi(v_tipo) then
    raise exception 'Una pratica di tipo % deve nascere con % fasi', v_tipo, cwp_numero_fasi(v_tipo);
  end if;

  insert into pratica (tipo, organizzazione_id, codice, titolo, stato, progetto_padre_id, anno_monitoraggio,
                       periodo_riferimento, codici_istat, copromotori, popolazione, crediti_previsti)
  select r.tipo, r.organizzazione_id, nullif(trim(r.codice), ''), r.titolo,
         coalesce(r.stato, 'attiva'), r.progetto_padre_id, r.anno_monitoraggio,
         coalesce(r.periodo_riferimento, '10 anni'), coalesce(r.codici_istat, '{}'),
         coalesce(r.copromotori, '{}'), r.popolazione, r.crediti_previsti
  from jsonb_populate_record(null::pratica, p_pratica) r
  returning * into v_pratica;

  insert into fase (pratica_id, numero, nome, responsabile, stato)
  select v_pratica.id, f.numero, f.nome, f.responsabile, coalesce(f.stato, 'non_iniziata')
  from jsonb_populate_recordset(null::fase, p_fasi) f;

  return v_pratica;
end $$;

-- Modifica dei dati del Progetto o del Rapporto (titolo, territorio,
-- co-promotori, periodo, popolazione, crediti previsti). Lo staff, con
-- motivazione facoltativa registrata nell'audit. Il periodo non si cambia
-- se ci sono già più Rapporti di quanti il nuovo periodo ne ammetta.
create or replace function staff_aggiorna_dati_pratica(p_pratica uuid, p_dati jsonb, p_motivazione text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare p pratica; v_periodo text; v_max int;
begin
  perform cwp_richiedi_staff();
  select * into p from pratica where id = p_pratica;
  if p.id is null then raise exception 'Pratica non trovata'; end if;
  if p_motivazione is not null and length(trim(p_motivazione)) > 0 then
    perform set_config('cwp.motivazione', trim(p_motivazione), true);
  end if;
  v_periodo := coalesce(p_dati ->> 'periodo_riferimento', p.periodo_riferimento);
  if p.tipo = 'progetto' and v_periodo <> p.periodo_riferimento then
    select coalesce(max(anno_monitoraggio), 0) into v_max from pratica
     where progetto_padre_id = p.id and tipo = 'rapporto';
    if v_max > cwp_massimo_rapporti(v_periodo) then
      raise exception 'Il Progetto ha già % Rapporti: il periodo «%» ne ammette %', v_max, v_periodo, cwp_massimo_rapporti(v_periodo);
    end if;
  end if;
  update pratica set
    titolo = case when p_dati ? 'titolo' then nullif(trim(p_dati ->> 'titolo'), '') else titolo end,
    codici_istat = case when p_dati ? 'codici_istat' and p.tipo = 'progetto'
                        then array(select jsonb_array_elements_text(p_dati -> 'codici_istat')) else codici_istat end,
    copromotori = case when p_dati ? 'copromotori' and p.tipo = 'progetto'
                       then array(select trim(x) from jsonb_array_elements_text(p_dati -> 'copromotori') x where trim(x) <> '')
                       else copromotori end,
    periodo_riferimento = case when p.tipo = 'progetto' then v_periodo else periodo_riferimento end,
    popolazione = case when p_dati ? 'popolazione' then nullif(p_dati ->> 'popolazione', '')::int else popolazione end,
    crediti_previsti = case when p_dati ? 'crediti_previsti' then nullif(p_dati ->> 'crediti_previsti', '')::int else crediti_previsti end,
    aggiornato_il = now()
  where id = p_pratica;
  -- Il periodo vale anche per i Rapporti del Progetto.
  if p.tipo = 'progetto' then
    update pratica set periodo_riferimento = v_periodo
     where progetto_padre_id = p.id and periodo_riferimento <> v_periodo;
  end if;
end $$;
grant execute on function staff_aggiorna_dati_pratica(uuid, jsonb, text) to authenticated;


-- ---------------------------------------------------------------------
-- 8. AVVISO DOPO 2 ANNI SENZA RAPPORTI (Guida 6.4.1)
-- ---------------------------------------------------------------------
-- Funzione chiamata ogni giorno da pg_cron (script 09): alle scadenze
-- delle fasi si aggiungono i Progetti registrati da almeno 2 anni senza
-- alcun Rapporto. Lo staff chiede al Comune una prova di attività (entro
-- 20 giorni) e la pubblica.
create or replace function genera_notifiche_scadenze()
returns integer
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
    if not exists (select 1 from notifica n
                    where n.chiave = v_evento || ':' || f.id || ':' || f.data_prevista_chiusura) then
      insert into notifica (utente_id, pratica_id, evento, titolo, testo, chiave)
      select d, f.pratica_id, v_evento, v_titolo, cwp_etichetta_pratica(f.pratica_id),
             v_evento || ':' || f.id || ':' || f.data_prevista_chiusura
      from unnest(array(select cwp_clienti_pratica(f.pratica_id)) || array(select cwp_staff())) d;
      v_n := v_n + 1;
    end if;
  end loop;

  for f in
    select p.id from pratica p
     where p.tipo = 'progetto' and p.stato in ('attiva', 'chiusa')
       and p.data_registrazione is not null
       and p.data_registrazione <= current_date - interval '2 years'
       and not exists (select 1 from pratica r where r.progetto_padre_id = p.id and r.tipo = 'rapporto')
  loop
    if not exists (select 1 from notifica n where n.chiave = 'nessun_rapporto:' || f.id) then
      insert into notifica (utente_id, pratica_id, evento, titolo, testo, chiave)
      select d, f.id, 'nessun_rapporto',
             'Progetto senza Rapporti da 2 anni',
             cwp_etichetta_pratica(f.id) || ' — chiedere al Comune una prova di attività entro 20 giorni (Guida 6.4.1)',
             'nessun_rapporto:' || f.id
      from unnest(array(select cwp_staff())) d;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;


-- ---------------------------------------------------------------------
-- 9. DOCUMENTI RICHIESTI DALLA GUIDA E DOCUMENTI RISERVATI
-- ---------------------------------------------------------------------
-- Guida 6.2.4 e Tabella 3 (Progetto), 6.3.1 e Tabella 4 (Rapporto).
-- Le voci si aggiungono una volta; l'Amministratore può toglierle.
insert into documento_richiesto (tipo_pratica, fase_numero, tipologia, descrizione) values
  ('progetto', 1, 'Modulo di descrizione del progetto', 'Con la localizzazione e i codici ISTAT del territorio'),
  ('progetto', 3, 'Contratto con l''ente di validazione e verifica', 'Non pubblico (Guida 7.3)'),
  ('progetto', 4, 'Documento di proprietà del progetto', 'Autodichiarazione del soggetto promotore (Standard 4.4)'),
  ('progetto', 4, 'Documento riassuntivo delle risultanze del periodo di feedback pubblico', 'Anche se non ci sono state osservazioni'),
  ('progetto', 5, 'Rapporto di validazione', 'Sottoscritto digitalmente dall''ente, pubblico'),
  ('rapporto', 1, 'Modulo di descrizione del rapporto di monitoraggio', null),
  ('rapporto', 3, 'Contratto con l''ente di validazione e verifica', 'Non pubblico (Guida 7.3)'),
  ('rapporto', 4, 'Documento riassuntivo delle risultanze del periodo di feedback pubblico', 'Anche se non ci sono state osservazioni'),
  ('rapporto', 5, 'Rapporto di verifica', 'Sottoscritto digitalmente dall''ente, pubblico'),
  ('rapporto', 5, 'Dichiarazione relativa all''effettività della generazione dei crediti', 'Dell''ente di validazione e verifica')
on conflict (tipo_pratica, fase_numero, tipologia) do nothing;

-- Il contratto con l'ente (Guida 7.3) e la versione privata del Modulo di
-- descrizione (Guida 7.1) non sono mai pubblici.
create or replace function cwp_tipologia_riservata(p_tipologia text)
returns boolean
language sql immutable as $$
  select coalesce(p_tipologia ilike 'Contratto con l''ente%' or p_tipologia ilike '%versione privata%', false);
$$;

create or replace function documento_riservato()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.pubblico and cwp_tipologia_riservata(new.tipologia) then
    raise exception 'Un documento «%» non può essere pubblico (Guida 7.1 e 7.3)', new.tipologia;
  end if;
  return new;
end $$;

drop trigger if exists trg_documento_riservato on documento;
create trigger trg_documento_riservato before insert or update of pubblico, tipologia on documento
  for each row execute function documento_riservato();


-- ---------------------------------------------------------------------
-- 10. TARIFFE E SOSPENSIONE FINO AL SALDO
-- ---------------------------------------------------------------------
-- Voce dello Schema tariffario a cui si riferisce il pagamento.
alter table pagamento add column if not exists voce text not null default 'altro';
alter table pagamento drop constraint if exists chk_pagamento_voce;
alter table pagamento add constraint chk_pagamento_voce
  check (voce in ('iscrizione', 'registrazione', 'emissione', 'vendita', 'altro'));

-- Apertura di una fase: oltre ai controlli precedenti,
--  - con una fattura scaduta e non saldata le attività sono sospese
--    (Schema tariffario, cap. 1);
--  - la fase 5 (validazione o verifica) parte solo con la tariffa di
--    iscrizione saldata (Guida 6.2.1 e 6.3.1).
create or replace function staff_apri_fase(p_fase uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare f fase; v_stato_pratica stato_pratica; v_tipo tipo_pratica;
begin
  perform cwp_richiedi_staff();
  select * into f from fase where id = p_fase;
  if f.id is null then raise exception 'Fase non trovata'; end if;
  select stato, tipo into v_stato_pratica, v_tipo from pratica where id = f.pratica_id;
  if v_stato_pratica <> 'attiva' then
    raise exception 'La pratica non è attiva: riattivala prima di aprire una fase';
  end if;
  if f.stato <> 'non_iniziata' then
    raise exception 'La fase è già stata aperta';
  end if;
  if exists (select 1 from pagamento where pratica_id = f.pratica_id and not pagato
              and scadenza is not null and scadenza < current_date) then
    raise exception 'Attività sospese fino al saldo: c''è una fattura scaduta non pagata (Schema tariffario). Registra il pagamento per proseguire.';
  end if;
  if f.numero = 5 and exists (select 1 from pagamento where pratica_id = f.pratica_id
                                 and voce = 'iscrizione' and not pagato) then
    raise exception 'La tariffa di iscrizione va saldata prima della fase di validazione o verifica (Guida 6.2.1 e 6.3.1)';
  end if;
  update fase
     set stato = 'in_corso',
         data_apertura = current_date,
         data_prevista_chiusura = coalesce(data_prevista_chiusura, current_date + cwp_durata_fase(v_tipo, numero)),
         aggiornato_il = now()
   where id = p_fase;
end $$;


-- ---------------------------------------------------------------------
-- 11. VERIFICA SULL'ACCURATEZZA E ACCERTAMENTI (Guida 6.5.2)
-- ---------------------------------------------------------------------
alter table fase add column if not exists verifica_accuratezza boolean not null default false;
alter table fase add column if not exists accertamenti integer not null default 0;
alter table fase drop constraint if exists chk_accertamenti;
alter table fase add constraint chk_accertamenti check (accertamenti between 0 and 3);

-- p_tipo = 'accuratezza': avvia la verifica sull'accuratezza (+15 giorni
-- alla scadenza, una volta); 'accertamento': un ulteriore accertamento
-- (+10 giorni, al massimo 3, solo dopo la verifica sull'accuratezza).
-- Solo nelle fasi di verifica documentale (2 e 6) aperte; motivazione
-- obbligatoria, nell'audit.
create or replace function staff_estendi_verifica(p_fase uuid, p_tipo text, p_motivazione text)
returns void
language plpgsql security definer set search_path = public as $$
declare f fase; v_stato stato_pratica;
begin
  perform cwp_richiedi_staff();
  perform cwp_richiedi_motivazione(p_motivazione);
  select * into f from fase where id = p_fase;
  if f.id is null then raise exception 'Fase non trovata'; end if;
  select stato into v_stato from pratica where id = f.pratica_id;
  if v_stato <> 'attiva' then raise exception 'La pratica non è attiva'; end if;
  if f.numero not in (2, 6) then
    raise exception 'Solo nelle fasi di verifica documentale (2 e 6)';
  end if;
  if f.stato not in ('in_corso', 'in_attesa_integrazione') then
    raise exception 'La fase non è aperta';
  end if;
  if p_tipo = 'accuratezza' then
    if f.verifica_accuratezza then raise exception 'La verifica sull''accuratezza è già avviata'; end if;
    update fase set verifica_accuratezza = true,
                    data_prevista_chiusura = coalesce(data_prevista_chiusura, current_date) + 15,
                    aggiornato_il = now()
     where id = p_fase;
  elsif p_tipo = 'accertamento' then
    if not f.verifica_accuratezza then
      raise exception 'Gli accertamenti seguono la verifica sull''accuratezza';
    end if;
    if f.accertamenti >= 3 then
      raise exception 'Già svolti 3 accertamenti: la richiesta va respinta o accettata (Guida 6.5.2)';
    end if;
    update fase set accertamenti = accertamenti + 1,
                    data_prevista_chiusura = coalesce(data_prevista_chiusura, current_date) + 10,
                    aggiornato_il = now()
     where id = p_fase;
  else
    raise exception 'Tipo non valido: accuratezza o accertamento';
  end if;
end $$;
grant execute on function staff_estendi_verifica(uuid, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 12. NOTIFICHE (ridefinizione di notifiche_eventi, script 21)
-- ---------------------------------------------------------------------
create or replace function notifiche_eventi()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pratica uuid;
  v_etichetta text;
  v_clienti uuid[];
  v_staff uuid[];
begin
  v_pratica := coalesce((to_jsonb(new) ->> 'pratica_id')::uuid, (to_jsonb(new) ->> 'id')::uuid);
  v_etichetta := cwp_etichetta_pratica(v_pratica);
  v_clienti := array(select cwp_clienti_pratica(v_pratica));
  v_staff := array(select cwp_staff());

  if tg_table_name = 'fase' then
    if tg_op = 'INSERT' and new.stato = 'in_corso' then
      perform cwp_notifica(v_clienti, v_pratica, 'apertura_fase',
        'Aperta la fase «' || new.nome || '»', v_etichetta);
    end if;
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
    -- Verifica sull'accuratezza o accertamento: nuova scadenza al Comune.
    if tg_op = 'UPDATE' and (new.verifica_accuratezza is distinct from old.verifica_accuratezza
                             or new.accertamenti is distinct from old.accertamenti) then
      perform cwp_notifica(v_clienti, v_pratica, 'verifica_accuratezza',
        case when new.accertamenti > old.accertamenti
             then 'Ulteriore accertamento (n. ' || new.accertamenti || ') nella fase «' || new.nome || '»'
             else 'Avviata la verifica sull''accuratezza nella fase «' || new.nome || '»' end,
        v_etichetta || coalesce(' — nuova scadenza ' || to_char(new.data_prevista_chiusura, 'DD/MM/YYYY'), ''));
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
        'Aperto il periodo di feedback pubblico',
        v_etichetta || ' — fino al ' || coalesce(to_char(new.data_chiusura, 'DD/MM/YYYY'), '—'));
    end if;

  elsif tg_table_name = 'commento' then
    if tg_op = 'INSERT' then
      perform cwp_notifica(v_staff, v_pratica, 'nuovo_commento',
        'Nuova osservazione da moderare', v_etichetta);
    elsif new.stato = 'pubblicato' and old.stato = 'ricevuto' then
      perform cwp_notifica(v_clienti, v_pratica, 'commento_ammesso',
        'Nuova osservazione a cui rispondere',
        v_etichetta || ' — Osservazione n. ' || coalesce(new.numero::text, '?'));
    end if;

  elsif tg_table_name = 'consultazione_errata' then
    perform cwp_notifica(v_clienti, v_pratica, 'errata_corrige',
      'Errata corrige pubblicata nel feedback pubblico',
      v_etichetta || case when new.riparte
        then ' — il feedback pubblico riparte: nuova chiusura ' || to_char(new.nuova_chiusura, 'DD/MM/YYYY')
        else '' end);

  elsif tg_table_name = 'nota_fase' then
    if new.visibile_cliente then
      perform cwp_notifica(v_clienti, v_pratica, 'nota_fase',
        'Nuova nota della Fondazione',
        v_etichetta || ' — ' || left(new.testo, 160));
    end if;

  elsif tg_table_name = 'messaggio' then
    if new.autore_ruolo in ('operatore', 'admin') then
      perform cwp_notifica(v_clienti, v_pratica, 'messaggio',
        'Nuovo messaggio dalla Fondazione', v_etichetta || ' — ' || left(new.testo, 160));
    else
      perform cwp_notifica(v_staff, v_pratica, 'messaggio',
        'Nuovo messaggio dal Cliente', v_etichetta || ' — ' || left(new.testo, 160));
    end if;

  elsif tg_table_name = 'pagamento' then
    if tg_op = 'INSERT' then
      perform cwp_notifica(v_clienti, v_pratica, 'nuovo_pagamento',
        'Nuova voce di pagamento',
        v_etichetta || ' — ' || coalesce(new.descrizione, 'voce')
          || coalesce(' · scadenza ' || to_char(new.scadenza, 'DD/MM/YYYY'), ''));
    end if;

  elsif tg_table_name = 'pratica' then
    if tg_op = 'UPDATE' and new.stato is distinct from old.stato then
      perform cwp_notifica(v_clienti, v_pratica,
        case when new.stato = 'chiusa' then 'chiusura_pratica' else 'cambio_stato' end,
        case when new.stato = 'ritirata' then 'Progetto ritirato dal Programma'
             when new.stato = 'attiva' and old.stato = 'ritirata' then 'Progetto rientrato nel Programma'
             else 'Pratica ' || case new.stato when 'attiva' then 'riattivata' when 'sospesa' then 'sospesa'
                                               when 'annullata' then 'annullata' else 'chiusa' end end,
        v_etichetta || coalesce(' — ' || new.motivazione_stato, ''));
    end if;
  end if;
  return null;
end $$;
