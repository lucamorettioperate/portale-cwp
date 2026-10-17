-- =====================================================================
--  CORREZIONI DI SICUREZZA E FUNZIONAMENTO (analisi requisiti, ott. 2026)
--  Eseguire DOPO 06_utente_multi_org.sql, nel SQL Editor di Supabase.
--  Lo script è rieseguibile.
--
--  1. Audit trail scritto dal DATABASE (trigger), non più dal browser:
--     ogni operazione rilevante è tracciata automaticamente e nessuno
--     può inserire voci false. Consultabile solo da Operatori/Admin.
--  2. Documenti: versione calcolata dal database; la versione precedente
--     diventa non corrente anche quando carica il cliente; il cliente non
--     può caricare documenti già "pubblici".
--  3. Commenti: inseribili solo come RICEVUTO, solo dall'autore stesso,
--     solo a consultazione aperta (30 giorni).
--  4. Il cliente può rispondere ai commenti ammessi (prima era bloccato).
--  5. L'identità del commentatore non è leggibile dal cliente.
--  6. File nello storage: il cliente scarica solo i file dei documenti
--     che può vedere (visibile al cliente o pubblico).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. AUDIT TRAIL AUTOMATICO
-- ---------------------------------------------------------------------

-- Pratica di riferimento dell'evento (per filtrare l'audit per pratica
-- e includerlo nell'export del fascicolo).
alter table audit_event add column if not exists pratica_id uuid;
create index if not exists idx_audit_pratica on audit_event (pratica_id);

-- Solo il database scrive nell'audit: si rimuove l'inserimento dal browser.
drop policy if exists audit_insert on audit_event;

-- Consultazione: solo staff (requisito: "consultabile dagli Amministratori").
drop policy if exists audit_select on audit_event;
create policy audit_select on audit_event for select
  using (app_is_staff());

-- Funzione unica di registrazione, richiamata dai trigger delle tabelle.
create or replace function audit_registra()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_rec jsonb := coalesce(v_new, v_old);
  v_diff jsonb := '{}'::jsonb;
  v_chiave text;
  v_op text;
  v_prec text;
  v_succ text;
  v_motivazione text;
  v_oggetto uuid;
  v_pratica uuid;
  v_etichetta text;
begin
  -- Campi cambiati (solo per UPDATE): { campo: { da, a } }
  if tg_op = 'UPDATE' then
    for v_chiave in select jsonb_object_keys(v_new) loop
      if v_new -> v_chiave is distinct from v_old -> v_chiave
         and v_chiave not in ('aggiornato_il') then
        v_diff := v_diff || jsonb_build_object(
          v_chiave, jsonb_build_object('da', v_old -> v_chiave, 'a', v_new -> v_chiave));
      end if;
    end loop;
    -- Nessuna modifica sostanziale: niente evento.
    if v_diff = '{}'::jsonb then
      return null;
    end if;
    -- Documento: il passaggio automatico a "non corrente" della versione
    -- precedente non è un'azione dell'utente (è già tracciato il caricamento).
    if tg_table_name = 'documento'
       and (select bool_and(k in ('corrente','stato')) from jsonb_object_keys(v_diff) k) then
      return null;
    end if;
  end if;

  -- Oggetto e pratica di riferimento.
  if tg_table_name = 'utente_organizzazione' then
    v_oggetto := (v_rec ->> 'utente_id')::uuid;
  else
    v_oggetto := (v_rec ->> 'id')::uuid;
  end if;
  v_pratica := case
    when tg_table_name = 'pratica' then v_oggetto
    when v_rec ? 'pratica_id' then (v_rec ->> 'pratica_id')::uuid
  end;

  -- Stato precedente / successivo, leggibili come nell'esempio dei requisiti
  -- ("PRIMA VERIFICA / IN CORSO").
  v_etichetta := case when tg_table_name = 'fase' then (v_rec ->> 'nome') || ' / ' else '' end;
  if v_old ? 'stato' then v_prec := v_etichetta || upper(replace(v_old ->> 'stato', '_', ' ')); end if;
  if v_new ? 'stato' then v_succ := v_etichetta || upper(replace(v_new ->> 'stato', '_', ' ')); end if;

  -- Motivazione, quando il record la prevede.
  v_motivazione := coalesce(v_new ->> 'motivazione_stato', v_new ->> 'motivazione_moderazione');
  if tg_op = 'UPDATE'
     and not (v_diff ? 'motivazione_stato' or v_diff ? 'motivazione_moderazione' or v_diff ? 'stato') then
    v_motivazione := null;
  end if;

  -- Nome leggibile dell'operazione.
  v_op := case tg_table_name
    when 'pratica' then case
      when tg_op = 'INSERT' then 'creazione ' || coalesce(v_new ->> 'tipo', 'pratica')
      when v_diff ? 'stato' then 'cambio stato pratica'
      else 'modifica pratica' end
    when 'fase' then case
      when tg_op = 'INSERT' then 'creazione fase'
      when v_diff ? 'stato' and v_new ->> 'stato' = 'in_corso' and v_old ->> 'stato' = 'non_iniziata' then 'apertura fase'
      when v_diff ? 'stato' and v_new ->> 'stato' = 'completata' then 'chiusura fase'
      when v_diff ? 'stato' then 'cambio stato fase'
      when v_diff ? 'data_prevista_chiusura' then 'modifica scadenza fase'
      else 'modifica fase' end
    when 'documento' then case
      when tg_op = 'INSERT' then 'caricamento documento v' || (v_new ->> 'versione')
      when v_diff ? 'pubblico' or v_diff ? 'visibile_cliente' or v_diff ? 'visibile_fondazione' then 'modifica visibilità documento'
      else 'modifica documento' end
    when 'consultazione' then case
      when tg_op = 'INSERT' then 'apertura consultazione pubblica'
      when v_diff ? 'attiva' and not (v_new ->> 'attiva')::boolean then 'chiusura consultazione pubblica'
      when v_diff ? 'documento_id' then 'sostituzione documento in consultazione'
      else 'modifica consultazione' end
    when 'commento' then case
      when tg_op = 'INSERT' then 'ricezione commento'
      when v_diff ? 'risposta_testo' then 'risposta a commento'
      when v_diff ? 'stato' then 'moderazione commento'
      else 'modifica commento' end
    when 'richiesta_integrazione' then case
      when tg_op = 'INSERT' then 'richiesta di integrazione'
      when v_diff ? 'risolta' and (v_new ->> 'risolta')::boolean then 'integrazione completata'
      else 'modifica richiesta di integrazione' end
    when 'pagamento' then case
      when tg_op = 'INSERT' then 'registrazione voce di pagamento'
      when v_diff ? 'pagato' and (v_new ->> 'pagato')::boolean then 'registrazione incasso'
      else 'modifica pagamento' end
    when 'organizzazione' then case when tg_op = 'INSERT' then 'censimento organizzazione' else 'modifica organizzazione' end
    when 'ente_validazione' then case when tg_op = 'INSERT' then 'censimento ente di validazione' else 'modifica ente di validazione' end
    when 'profilo' then case when tg_op = 'INSERT' then 'creazione utente' else 'modifica utente' end
    when 'utente_organizzazione' then case when tg_op = 'INSERT' then 'associazione utente-organizzazione' else 'rimozione associazione utente-organizzazione' end
    else lower(tg_op) || ' ' || tg_table_name
  end;
  if tg_op = 'DELETE' and tg_table_name <> 'utente_organizzazione' then
    v_op := 'cancellazione ' || tg_table_name;
  end if;

  insert into audit_event (
    utente_id, ruolo, operazione, oggetto_tipo, oggetto_id, pratica_id,
    stato_precedente, stato_successivo, motivazione, dettaglio
  ) values (
    auth.uid(), app_ruolo(), v_op, tg_table_name, v_oggetto, v_pratica,
    v_prec, v_succ, v_motivazione,
    case when tg_op = 'UPDATE' then v_diff else v_rec end
  );
  return null;
end $$;

-- Aggancia il trigger alle tabelle applicative.
do $$
declare t text;
begin
  foreach t in array array[
    'pratica','fase','documento','consultazione','commento',
    'richiesta_integrazione','pagamento','organizzazione','ente_validazione',
    'profilo','utente_organizzazione'
  ] loop
    execute format('drop trigger if exists trg_audit on %I', t);
    execute format(
      'create trigger trg_audit after insert or update or delete on %I
         for each row execute function audit_registra()', t);
  end loop;
end $$;

-- L'audit è immutabile anche per chi usa il database direttamente
-- dal back-office applicativo: si blocca UPDATE/DELETE a livello di trigger.
create or replace function audit_immutabile()
returns trigger
language plpgsql as $$
begin
  raise exception 'L''audit trail non è modificabile né cancellabile';
end $$;

drop trigger if exists trg_audit_immutabile on audit_event;
create trigger trg_audit_immutabile
  before update or delete on audit_event
  for each row execute function audit_immutabile();


-- ---------------------------------------------------------------------
-- 2. DOCUMENTI: versione e "corrente" gestiti dal database
-- ---------------------------------------------------------------------
create or replace function documento_prima_inserimento()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Versione successiva per lo stesso nome nella pratica (considera
  -- anche le versioni che l'utente non vede).
  select coalesce(max(versione), 0) + 1 into new.versione
  from documento where pratica_id = new.pratica_id and nome = new.nome;

  new.corrente := true;
  if new.stato is null or new.stato = 'archiviato' then
    new.stato := 'corrente';
  end if;
  new.caricato_da := coalesce(auth.uid(), new.caricato_da);

  -- Il cliente non decide la visibilità: mai pubblico per errore.
  if not app_is_staff() then
    new.pubblico := false;
    new.visibile_cliente := true;
    new.visibile_fondazione := true;
    new.stato := 'corrente';
  end if;
  return new;
end $$;

drop trigger if exists trg_documento_prima on documento;
create trigger trg_documento_prima
  before insert on documento
  for each row execute function documento_prima_inserimento();

create or replace function documento_dopo_inserimento()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Le versioni precedenti restano nello storico, non più correnti.
  -- (una versione "pubblicata" in consultazione mantiene il suo stato)
  update documento
     set corrente = false,
         stato = case when stato = 'corrente' then 'archiviato'::stato_documento else stato end
   where pratica_id = new.pratica_id
     and nome = new.nome
     and id <> new.id
     and corrente;
  return null;
end $$;

drop trigger if exists trg_documento_dopo on documento;
create trigger trg_documento_dopo
  after insert on documento
  for each row execute function documento_dopo_inserimento();


-- ---------------------------------------------------------------------
-- 3. COMMENTI: inserimento controllato
-- ---------------------------------------------------------------------
-- La consultazione è aperta (attiva ed entro i 30 giorni) e appartiene
-- alla pratica indicata?
create or replace function consultazione_aperta(p_consultazione uuid, p_pratica uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from consultazione c
    where c.id = p_consultazione
      and c.pratica_id = p_pratica
      and c.attiva
      and current_date >= coalesce(c.data_apertura, current_date)
      and current_date <= coalesce(c.data_chiusura, current_date)
  );
$$;

drop policy if exists commento_insert on commento;
create policy commento_insert on commento for insert
  with check (
    auth.uid() is not null
    and autore_utente_id = auth.uid()
    and stato = 'ricevuto'
    and risposta_testo is null
    and motivazione_moderazione is null
    and consultazione_aperta(consultazione_id, pratica_id)
  );


-- ---------------------------------------------------------------------
-- 4. RISPOSTA DEL CLIENTE AI COMMENTI AMMESSI
-- ---------------------------------------------------------------------
create or replace function rispondi_commento(p_commento uuid, p_risposta text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_pratica uuid; v_stato stato_commento;
begin
  select pratica_id, stato into v_pratica, v_stato from commento where id = p_commento;
  if v_pratica is null or not pratica_mia(v_pratica) then
    raise exception 'Commento non trovato o non accessibile';
  end if;
  if v_stato not in ('pubblicato', 'risposto') then
    raise exception 'Si può rispondere solo ai commenti ammessi alla consultazione';
  end if;
  if p_risposta is null or length(trim(p_risposta)) = 0 then
    raise exception 'La risposta non può essere vuota';
  end if;
  update commento
     set risposta_testo = trim(p_risposta), stato = 'risposto'
   where id = p_commento;
end $$;

grant execute on function rispondi_commento(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. IDENTITÀ DEL COMMENTATORE NON LEGGIBILE DAL PORTALE
--    (resta nel database e nell'audit, visibile solo alla piattaforma)
-- ---------------------------------------------------------------------
revoke select on commento from anon, authenticated;
grant select (
  id, consultazione_id, pratica_id, testo, allegato_documento_id,
  stato, motivazione_moderazione, risposta_testo, creato_il
) on commento to authenticated;


-- ---------------------------------------------------------------------
-- 6. STORAGE: il cliente scarica solo i file dei documenti che può vedere
-- ---------------------------------------------------------------------
create or replace function file_visibile(p_path text)
returns boolean
language sql stable security definer set search_path = public as $$
  select app_is_staff() or exists (
    select 1 from documento d
    where d.storage_path = p_path
      and pratica_mia(d.pratica_id)
      and (d.visibile_cliente or d.pubblico)
  );
$$;

drop policy if exists documenti_select on storage.objects;
create policy documenti_select on storage.objects for select
  using (
    bucket_id = 'documenti'
    and (
      file_visibile(name)
      -- chi ha appena caricato il file lo vede (serve durante il caricamento)
      or owner_id = (auth.uid())::text
    )
  );


-- ---------------------------------------------------------------------
-- 7. Associazioni utente ↔ organizzazioni: modifica solo ciò che cambia
--    (così l'audit registra le sole associazioni aggiunte o rimosse).
-- ---------------------------------------------------------------------
create or replace function admin_imposta_organizzazioni(
  p_utente uuid,
  p_organizzazioni uuid[]
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_lista uuid[] := coalesce(p_organizzazioni, '{}');
begin
  if app_ruolo() <> 'admin' then
    raise exception 'Solo un amministratore può modificare le associazioni';
  end if;
  delete from utente_organizzazione
   where utente_id = p_utente
     and not (organizzazione_id = any (v_lista));
  insert into utente_organizzazione (utente_id, organizzazione_id)
  select p_utente, o from unnest(v_lista) o
  on conflict do nothing;
  -- campo singolo (prima organizzazione) per compatibilità
  update profilo
     set organizzazione_id = v_lista[1]
   where id = p_utente
     and organizzazione_id is distinct from v_lista[1];
end $$;
