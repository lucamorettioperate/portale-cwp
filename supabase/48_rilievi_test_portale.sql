-- =====================================================================
--  48 — RILIEVI «TEST_PORTALE_CWP» (29/10/2026)
--
--  Correzioni dei rilievi T01-T31 del documento TEST_PORTALE_CWP,
--  verificati il 30/10/2026 (documento di progetto
--  claude/test-portale-cwp-risposte.md). Scelte di Luca Moretti del
--  30/10/2026: «tutto ma lascia il marketing invariato» (T30 e T31 esclusi).
--
--   1. Nomi delle fasi (T01, T02): fase 5 del Progetto «Validazione del
--      progetto» (Guida 6.2.3); fase 7 «Registrazione del progetto» e,
--      per il Rapporto, «Emissione dei crediti» (prima «Chiusura»).
--   2. Dashboard (T05): staff_cruscotto restituisce anche l'ente di
--      validazione, le fatture scadute e in scadenza e le dichiarazioni di
--      cancellazione dei crediti venduti da ricevere (10 giorni, Guida
--      6.3.3).
--   3. Enti di validazione (T07): data di approvazione (Guida 3.4).
--   4. Codice fiscale e partita IVA (T08): controllo del formato e della
--      cifra di controllo quando si scrivono; codice fiscale obbligatorio
--      prima delle fatture di iscrizione e di registrazione.
--   5. Documenti obbligatori (T12, T25): colonna «obbligatorio» dei
--      documenti richiesti; le fasi 2 e 6 (verifiche documentali) si
--      chiudono solo con i documenti obbligatori delle fasi precedenti
--      (Guida 6.2.4 e 6.5), salvo deroga motivata dell'Amministratore;
--      Modulo di delega di rappresentanza tra i documenti della fase 1 (non
--      obbligatorio: serve solo con un rappresentante o più promotori).
--   6. Codici ISTAT (T15): la fase 2 del Progetto si chiude solo con
--      almeno un codice ISTAT (Standard 4.6).
--   7. Reclami (T17, T18): tipo «ricorso»; data di comunicazione dei
--      costi e costi non dovuti (Politica di reclamo, cap. 1).
--   8. Calcolo dei crediti (T20): l'ex post si crea e si conferma solo per
--      un anno concluso e per un Progetto registrato o un suo Rapporto
--      (Standard 4.5).
--   9. Codice della pratica sempre automatico (T14, N05): il codice
--      scritto a mano non si usa più; i codici esistenti restano.
--  10. Banca Dati Utenze senza nomi e indirizzi (T29, DPIA azione A1):
--      nominativo e indirizzo non sono più obbligatori e il portale non li
--      chiede; i dati già caricati restano finché non si ricarica
--      l'elenco.
--
--  Rieseguibile. Prova: t48.sql sul banco locale.
--  Registro sviluppo e deploy: cronologia del 30/10/2026.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Nomi delle fasi
-- ---------------------------------------------------------------------
select set_config('cwp.motivazione', 'Rilievi T01 e T02 del 29/10/2026: nomi delle fasi allineati alla Guida (6.2.3, 6.2.4, 6.3.2)', true);
update fase f set nome = 'Validazione del progetto'
  from pratica p where p.id = f.pratica_id and p.tipo = 'progetto' and f.numero = 5 and f.nome = 'Validazione e verifica';
update fase f set nome = 'Registrazione del progetto'
  from pratica p where p.id = f.pratica_id and p.tipo = 'progetto' and f.numero = 7 and f.nome = 'Chiusura';
update fase f set nome = 'Emissione dei crediti'
  from pratica p where p.id = f.pratica_id and p.tipo = 'rapporto' and f.numero = 7 and f.nome = 'Chiusura';
update durata_fase set nome = 'Validazione del progetto' where tipo_pratica = 'progetto' and numero = 5 and nome = 'Validazione e verifica';
update durata_fase set nome = 'Registrazione del progetto' where tipo_pratica = 'progetto' and numero = 7 and nome = 'Chiusura';
update durata_fase set nome = 'Emissione dei crediti' where tipo_pratica = 'rapporto' and numero = 7 and nome = 'Chiusura';

-- ---------------------------------------------------------------------
-- 2. Dashboard: ente, fatture e dichiarazioni di cancellazione (T05)
-- ---------------------------------------------------------------------
drop function if exists staff_cruscotto();
create function staff_cruscotto()
returns table (
  id uuid, codice text, tipo tipo_pratica, titolo text, anno_monitoraggio int,
  progetto_padre_id uuid, progetto_padre_codice text,
  organizzazione_id uuid, organizzazione text,
  stato stato_pratica,
  fase_numero int, fase_nome text, fase_stato stato_fase, fase_scadenza date,
  giorni_scadenza int,
  integrazioni_in_attesa int, integrazioni_da_verificare int,
  consultazione_attiva boolean, consultazione_chiusura date,
  aggiornato_il timestamptz,
  ente_validazione text,
  fatture_scadute int, fatture_in_scadenza int,
  dichiarazioni_da_ricevere int, dichiarazioni_scadute int
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
         greatest(p.aggiornato_il, ultimo.quando),
         ev.denominazione,
         coalesce(pg.scadute, 0)::int, coalesce(pg.in_scadenza, 0)::int,
         coalesce(dv.attese, 0)::int, coalesce(dv.scadute, 0)::int
  from pratica p
  join organizzazione o on o.id = p.organizzazione_id
  left join pratica padre on padre.id = p.progetto_padre_id
  left join ente_validazione ev on ev.id = p.ente_validazione_id
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
  -- Fatture (Guida 6.2.1 e 6.2.4: da saldare entro 30 giorni).
  left join lateral (
    select count(*) filter (where not g.pagato and g.scadenza < cwp_oggi()) as scadute,
           count(*) filter (where not g.pagato and g.scadenza between cwp_oggi() and cwp_oggi() + 7) as in_scadenza
    from pagamento g where g.pratica_id = p.id and g.scadenza is not null
  ) pg on true
  -- Dichiarazioni di cancellazione dei crediti venduti (Guida 6.3.3,
  -- Standard 6.2: entro 10 giorni dalla vendita).
  left join lateral (
    select count(*) filter (where v.cancellazione_documento_id is null) as attese,
           count(*) filter (where v.cancellazione_documento_id is null and v.data_vendita + 10 < cwp_oggi()) as scadute
    from credito_vendita v where v.pratica_id = p.id
  ) dv on true
  order by p.codice;
end $$;
revoke execute on function staff_cruscotto() from public, anon;
grant execute on function staff_cruscotto() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Data di approvazione degli enti di validazione (T07)
-- ---------------------------------------------------------------------
alter table ente_validazione add column if not exists approvato_il date;

-- ---------------------------------------------------------------------
-- 4. Codice fiscale e partita IVA (T08)
-- ---------------------------------------------------------------------
-- Partita IVA (e codice fiscale numerico di enti e società): 11 cifre con
-- la cifra di controllo (somma delle cifre dispari + cifre pari raddoppiate,
-- meno 9 se > 9).
create or replace function cwp_piva_valida(p text)
returns boolean
language plpgsql immutable as $$
declare s int := 0; d int; i int;
begin
  if p is null or p !~ '^[0-9]{11}$' then return false; end if;
  for i in 1..10 loop
    d := substr(p, i, 1)::int;
    if i % 2 = 0 then d := d * 2; if d > 9 then d := d - 9; end if; end if;
    s := s + d;
  end loop;
  return (10 - s % 10) % 10 = substr(p, 11, 1)::int;
end $$;

-- Codice fiscale: 11 cifre (enti e società, come la partita IVA) oppure
-- 16 caratteri delle persone fisiche, con il carattere di controllo
-- (anche con le lettere dell'omocodia).
create or replace function cwp_cf_valido(p text)
returns boolean
language plpgsql immutable as $$
declare
  v text := upper(trim(coalesce(p, '')));
  dispari int[] := array[1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23];
  s int := 0; c text; k int; i int;
begin
  if v ~ '^[0-9]{11}$' then return cwp_piva_valida(v); end if;
  if v !~ '^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$' then return false; end if;
  for i in 1..15 loop
    c := substr(v, i, 1);
    k := case when c ~ '[0-9]' then c::int else ascii(c) - 65 end;
    if i % 2 = 1 then s := s + dispari[k + 1]; else s := s + k; end if;
  end loop;
  return chr(65 + s % 26) = substr(v, 16, 1);
end $$;

-- Il controllo vale quando il dato si scrive o si cambia: le anagrafiche
-- già presenti non si bloccano finché non si modificano quei campi.
create or replace function organizzazione_dati_fiscali()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.codice_fiscale := nullif(upper(regexp_replace(coalesce(new.codice_fiscale, ''), '\s', '', 'g')), '');
  new.partita_iva := nullif(regexp_replace(coalesce(new.partita_iva, ''), '[\s]|^IT', '', 'gi'), '');
  if new.codice_fiscale is not null
     and (tg_op = 'INSERT' or new.codice_fiscale is distinct from old.codice_fiscale)
     and not cwp_cf_valido(new.codice_fiscale) then
    raise exception 'Codice fiscale non valido: 11 cifre per enti e società, 16 caratteri per le persone, con il carattere di controllo corretto';
  end if;
  if new.partita_iva is not null
     and (tg_op = 'INSERT' or new.partita_iva is distinct from old.partita_iva)
     and not cwp_piva_valida(new.partita_iva) then
    raise exception 'Partita IVA non valida: 11 cifre con la cifra di controllo corretta';
  end if;
  return new;
end $$;
drop trigger if exists trg_organizzazione_dati_fiscali on organizzazione;
create trigger trg_organizzazione_dati_fiscali before insert or update of codice_fiscale, partita_iva on organizzazione
  for each row execute function organizzazione_dati_fiscali();

-- Le fatture di iscrizione e di registrazione (Guida 6.2.1 e 6.2.4) si
-- registrano solo se l'organizzazione ha un codice fiscale valido.
create or replace function pagamento_dati_fiscali()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cf text; v_org text;
begin
  if new.voce in ('iscrizione', 'registrazione') then
    select o.codice_fiscale, o.denominazione into v_cf, v_org
      from pratica p join organizzazione o on o.id = p.organizzazione_id where p.id = new.pratica_id;
    if v_cf is null or not cwp_cf_valido(v_cf) then
      raise exception 'Prima della fattura indica in Anagrafiche un codice fiscale valido per «%» (Guida 6.2.1)', v_org;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_pagamento_dati_fiscali on pagamento;
create trigger trg_pagamento_dati_fiscali before insert on pagamento
  for each row execute function pagamento_dati_fiscali();

-- ---------------------------------------------------------------------
-- 5. Documenti obbligatori (T12) e delega di rappresentanza (T25)
-- ---------------------------------------------------------------------
alter table documento_richiesto add column if not exists obbligatorio boolean not null default true;
insert into documento_richiesto (tipo_pratica, fase_numero, tipologia, descrizione, obbligatorio) values
  ('progetto', 1, 'Modulo di delega di rappresentanza',
   'Solo se il progetto è presentato da un rappresentante o da più soggetti promotori (Guida 7.2)', false)
on conflict (tipo_pratica, fase_numero, tipologia) do update set obbligatorio = false;

-- Documenti obbligatori mancanti nelle fasi da 1 a p_fino_a: una voce di
-- documento_richiesto attiva e obbligatoria è presente se nella fase con
-- quel numero c'è un documento corrente con quella tipologia.
create or replace function cwp_documenti_mancanti(p_pratica uuid, p_fino_a int)
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(r.tipologia || ' (fase ' || r.fase_numero || ')' order by r.fase_numero, r.tipologia), '{}')
    from documento_richiesto r
    join pratica p on p.id = p_pratica and p.tipo = r.tipo_pratica
   where r.attivo and r.obbligatorio and r.fase_numero <= p_fino_a
     and not exists (
       select 1 from documento d join fase f on f.id = d.fase_id
        where d.pratica_id = p_pratica and f.numero = r.fase_numero
          and d.corrente and d.tipologia = r.tipologia);
$$;
revoke execute on function cwp_documenti_mancanti(uuid, int) from public, anon;
grant execute on function cwp_documenti_mancanti(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Chiusura delle fasi: documenti (T12) e codici ISTAT (T15).
--    Uguale alla versione dello script 39 più i due controlli.
-- ---------------------------------------------------------------------
create or replace function staff_chiudi_fase(p_fase uuid, p_motivazione text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare f fase; p pratica; v_aperte int; c consultazione; v_mancanti text[]; v_deroga boolean := false;
begin
  perform cwp_richiedi_staff();
  select * into f from fase where id = p_fase;
  if f.id is null then raise exception 'Fase non trovata'; end if;
  if f.stato not in ('in_corso', 'in_attesa_integrazione') then
    raise exception 'Si può chiudere solo una fase aperta';
  end if;
  select * into p from pratica where id = f.pratica_id;

  -- T15: la prima verifica documentale del Progetto controlla anche il
  -- territorio (Standard 4.6: localizzazione con il codice ISTAT).
  if f.numero = 2 and p.tipo = 'progetto' and cardinality(p.codici_istat) = 0 then
    raise exception 'Indica il territorio del Progetto (almeno un codice ISTAT) prima di chiudere la prima verifica documentale (Standard 4.6)';
  end if;

  -- T12: le verifiche documentali (fasi 2 e 6) si chiudono solo con i
  -- documenti obbligatori delle fasi precedenti (Guida 6.2.4 e 6.5).
  -- Deroga: solo l'Amministratore, con motivazione (resta nell'audit).
  if f.numero in (2, 6) then
    v_mancanti := cwp_documenti_mancanti(f.pratica_id, f.numero - 1);
    if cardinality(v_mancanti) > 0 then
      if app_is_admin() and p_motivazione is not null and length(trim(p_motivazione)) >= 3 then
        v_deroga := true;
      else
        raise exception 'Mancano documenti obbligatori: %. La verifica documentale si chiude solo con la documentazione completa (Guida 6.2.4 e 6.5)%',
          array_to_string(v_mancanti, '; '),
          case when app_is_admin() then '; per una deroga indica la motivazione' else '' end;
      end if;
    end if;
  end if;

  -- Fase 3 = feedback pubblico: si chiude solo a periodo concluso.
  if f.numero = 3 then
    select * into c from consultazione
     where pratica_id = f.pratica_id order by creato_il desc limit 1;
    if c.id is null then
      raise exception 'La fase 3 è il feedback pubblico: aprilo dal riquadro «Feedback pubblico»; la fase si chiude al termine del periodo';
    end if;
    if c.attiva and c.data_chiusura is not null and cwp_oggi() <= c.data_chiusura then
      raise exception 'Il feedback pubblico resta aperto fino al % compreso: la fase 3 si chiude dal giorno successivo',
        to_char(c.data_chiusura, 'DD/MM/YYYY');
    end if;
    if c.attiva then
      update consultazione
         set attiva = false, chiusa_il = now(), chiusura_tipo = 'ordinaria'
       where id = c.id;
    end if;
  end if;

  -- Con integrazioni ancora aperte la chiusura è un'eccezione: va motivata.
  select count(*) into v_aperte from richiesta_integrazione
   where fase_id = p_fase and not risolta;
  if v_aperte > 0 then
    perform cwp_richiedi_motivazione(p_motivazione);
  elsif p_motivazione is not null and length(trim(p_motivazione)) > 0 then
    perform set_config('cwp.motivazione', trim(p_motivazione), true);
  end if;
  if v_deroga then
    perform set_config('cwp.motivazione',
      'Deroga dell''Amministratore: chiusa senza ' || array_to_string(v_mancanti, '; ') || '. Motivazione: ' || trim(p_motivazione), true);
  end if;
  update fase
     set stato = 'completata',
         data_effettiva_chiusura = current_date,
         aggiornato_il = now()
   where id = p_fase;
end $$;
grant execute on function staff_chiudi_fase(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Reclami: ricorso (T17) e costi (T18)
-- ---------------------------------------------------------------------
alter table reclamo drop constraint if exists reclamo_tipo_check;
alter table reclamo add constraint reclamo_tipo_check check (tipo in ('reclamo', 'ricorso', 'chiarimento'));
alter table reclamo add column if not exists costi_comunicati_il date;
alter table reclamo add column if not exists costi_non_dovuti boolean not null default false;

create or replace function reclamo_codice()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pref text; v_n int;
begin
  if new.codice is null then
    v_pref := case new.tipo when 'chiarimento' then 'CHI' when 'ricorso' then 'RIC' else 'REC' end || '-' || extract(year from new.ricevuto_il)::int || '-';
    perform pg_advisory_xact_lock(hashtext('reclamo:' || v_pref));
    select coalesce(max(substring(codice from length(v_pref) + 1)::int), 0) + 1 into v_n
      from reclamo where codice like v_pref || '%';
    new.codice := v_pref || lpad(v_n::text, 3, '0');
  end if;
  new.aggiornato_il := now();
  if new.risposta is not null and length(trim(new.risposta)) > 0 and new.risposto_il is null then
    new.risposto_il := current_date;
  end if;
  -- Politica di reclamo, cap. 1: se il reclamo o il ricorso porta ad
  -- annullare un'azione, i costi non sono dovuti.
  if new.costi_non_dovuti then
    new.costi := 0;
  end if;
  return new;
end $$;

create or replace function reclamo_notifiche()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform cwp_notifica(array(select cwp_staff()), new.pratica_id, 'nuovo_reclamo',
      case new.tipo when 'chiarimento' then 'Nuova richiesta di chiarimento ' when 'ricorso' then 'Nuovo ricorso ' else 'Nuovo reclamo ' end || new.codice,
      new.oggetto);
  elsif new.risposta is distinct from old.risposta and new.risposta is not null and new.creato_da is not null
        and exists (select 1 from profilo where id = new.creato_da and ruolo = 'cliente') then
    perform cwp_notifica(array[new.creato_da], new.pratica_id, 'risposta_reclamo',
      'Risposta a ' || new.codice, new.oggetto);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 8. Calcolo dei crediti ex post (T20)
-- ---------------------------------------------------------------------
-- Vero se il Progetto (o il Progetto del Rapporto) è registrato: fase 6
-- completata o data di registrazione (stesso criterio dello script 45).
create or replace function cwp_progetto_registrato(p_pratica uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select pr.data_registrazione is not null
        or exists (select 1 from fase f where f.pratica_id = pr.id and f.numero = 6 and f.stato = 'completata')
      from pratica p
      join pratica pr on pr.id = case when p.tipo = 'rapporto' then p.progetto_padre_id else p.id end
     where p.id = p_pratica), false);
$$;

create or replace function calcolo_ex_post_ammesso()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo <> 'ex_post' then return new; end if;
  -- Solo alla creazione, al cambio di tipo, anno o pratica e alla conferma:
  -- i calcoli già esistenti si possono ancora aprire e ricalcolare.
  if tg_op = 'UPDATE'
     and new.tipo = old.tipo and new.anno = old.anno and new.pratica_id = old.pratica_id
     and not (old.stato = 'bozza' and new.stato = 'confermato') then
    return new;
  end if;
  if new.anno >= extract(year from cwp_oggi())::int then
    raise exception 'Il calcolo ex post usa le letture reali: l''anno % non è ancora concluso. Per una previsione usa il calcolo ex ante', new.anno;
  end if;
  if not cwp_progetto_registrato(new.pratica_id) then
    raise exception 'I crediti ex post si calcolano solo dopo la registrazione del Progetto (Standard 4.5: la data di registrazione è la data di inizio del progetto)';
  end if;
  return new;
end $$;
drop trigger if exists trg_calcolo_ex_post on calcolo_crediti;
create trigger trg_calcolo_ex_post before insert or update on calcolo_crediti
  for each row execute function calcolo_ex_post_ammesso();

-- ---------------------------------------------------------------------
-- 9. Codice della pratica sempre automatico (T14, N05)
-- ---------------------------------------------------------------------
-- Guida 6.2.1: l'ID univoco lo assegna il soggetto promotore del
-- programma. Un codice scritto a mano alla creazione si ignora; i codici
-- esistenti non cambiano.
create or replace function pratica_codice_automatico()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_anno text := to_char(now(), 'YYYY'); v_n int; v_padre text;
begin
  if new.tipo = 'rapporto' then
    select codice into v_padre from pratica where id = new.progetto_padre_id;
    new.codice := coalesce(v_padre, 'CWP') || '-RM' || new.anno_monitoraggio;
  else
    perform pg_advisory_xact_lock(hashtext('pratica_codice:' || v_anno));
    select coalesce(max(substring(codice from '^CWP-' || v_anno || '-(\d+)$')::int), 0) + 1
      into v_n from pratica where tipo = 'progetto';
    new.codice := 'CWP-' || v_anno || '-' || lpad(v_n::text, 4, '0');
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 10. Banca Dati Utenze senza nomi e indirizzi (T29)
-- ---------------------------------------------------------------------
alter table calcolo_utenza alter column nominativo drop not null;
alter table calcolo_utenza alter column indirizzo drop not null;

-- Salvataggio di un'utenza dal modulo: come nello script 40, ma senza
-- nominativo e indirizzo (non si salvano più: restano vuoti).
create or replace function admin_salva_utenza(p_calcolo uuid, p_id bigint, p_utenza jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_pratica uuid; v_stato text; v_id bigint; v_prima calcolo_utenza; v_dopo calcolo_utenza;
  v_err text; v_campi text[];
  u jsonb := coalesce(p_utenza, '{}'::jsonb);
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore gestisce il calcolo dei crediti';
  end if;
  select pratica_id, stato into v_pratica, v_stato from calcolo_crediti where id = p_calcolo;
  if v_pratica is null then raise exception 'Calcolo non trovato'; end if;
  if v_stato = 'confermato' then raise exception 'I dati di un calcolo confermato non si modificano'; end if;
  -- Controlli con messaggi chiari (i vincoli della tabella restano la garanzia).
  if length(trim(coalesce(u ->> 'codice', ''))) = 0 then raise exception 'Indica il codice utenza'; end if;
  if coalesce(u ->> 'tipo', '') not in ('UD', 'UnD') then raise exception 'Tipo di utenza non valido'; end if;
  if jsonb_typeof(u -> 'produzione_totale_kg') <> 'number' or (u ->> 'produzione_totale_kg')::numeric < 0 then
    raise exception 'Indica la produzione totale in kg (0 o più)';
  end if;
  if u ->> 'tipo' = 'UnD' and jsonb_typeof(u -> 'componenti') = 'number' then
    raise exception 'Il numero di componenti vale solo per le utenze domestiche';
  end if;
  v_err := cwp_frazioni_errore(u -> 'frazioni');
  if v_err is not null then raise exception 'Frazioni: %', v_err; end if;

  perform set_config('cwp.utenza_singola', '1', true);
  begin
    if p_id is null then
      insert into calcolo_utenza (calcolo_id, codice, tipo, nominativo, indirizzo, componenti, mq,
                                  categoria_tariffaria, categoria_simulazione, produzione_totale_kg, frazioni)
      values (p_calcolo, u ->> 'codice', u ->> 'tipo', null, null,
              (u ->> 'componenti')::int, (u ->> 'mq')::numeric, u ->> 'categoria_tariffaria',
              u ->> 'categoria_simulazione', (u ->> 'produzione_totale_kg')::numeric, u -> 'frazioni')
      returning * into v_dopo;
      v_campi := array['nuova utenza'];
    else
      select * into v_prima from calcolo_utenza where id = p_id and calcolo_id = p_calcolo;
      if v_prima.id is null then raise exception 'Utenza non trovata'; end if;
      update calcolo_utenza
         set codice = u ->> 'codice', tipo = u ->> 'tipo', nominativo = null,
             indirizzo = null, componenti = (u ->> 'componenti')::int, mq = (u ->> 'mq')::numeric,
             categoria_tariffaria = u ->> 'categoria_tariffaria', categoria_simulazione = u ->> 'categoria_simulazione',
             produzione_totale_kg = (u ->> 'produzione_totale_kg')::numeric, frazioni = u -> 'frazioni'
       where id = p_id
      returning * into v_dopo;
      select array_agg(k order by k) into v_campi
        from jsonb_each(to_jsonb(v_dopo)) d(k, v)
       where k not in ('id', 'calcolo_id', 'creato_il') and v is distinct from to_jsonb(v_prima) -> k;
    end if;
  exception when unique_violation then
    raise exception 'Il codice utenza % è già presente in questo calcolo', u ->> 'codice';
  end;
  perform set_config('cwp.utenza_singola', '0', true);

  if v_campi is not null then
    insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, oggetto_id, pratica_id, dettaglio)
    values (auth.uid(), app_ruolo(), case when p_id is null then 'inserimento utenza' else 'modifica utenza' end,
            'calcolo_crediti', p_calcolo, v_pratica,
            jsonb_build_object('codice', v_dopo.codice, 'tipo', v_dopo.tipo, 'campi', to_jsonb(v_campi)));
  end if;
  return v_dopo.id;
end $$;

-- Controllo finale (sola lettura).
select (select count(*) from fase where nome in ('Validazione e verifica', 'Chiusura')) as fasi_con_vecchio_nome,
       (select count(*) from documento_richiesto where obbligatorio = false) as documenti_non_obbligatori,
       (select count(*) from pg_trigger where tgname in ('trg_calcolo_ex_post', 'trg_organizzazione_dati_fiscali', 'trg_pagamento_dati_fiscali')) as nuovi_trigger;
