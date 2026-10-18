-- =====================================================================
--  COMPLETAMENTO FUNZIONALE (confronto con i requisiti, 18/10/2026)
--  Eseguire DOPO 20_rinforzi_integrita.sql. Lo script è rieseguibile.
--  Registro sviluppo e deploy: capitolo «Database», cronologia del 18/10.
--
--  1. Rapporti di Monitoraggio con un percorso proprio di 4 fasi
--     (decisione di Luca del 18/10): Caricamento del rapporto, Verifica
--     documentale, Validazione e verifica, Chiusura. Durate separate per
--     Progetto e Rapporto, modificabili dall'Amministratore.
--  2. Documenti richiesti per fase (requisiti §4): elenco configurabile
--     dall'Amministratore; la fase mostra cosa c'è e cosa manca, senza
--     bloccare la chiusura (decisione di Luca del 18/10).
--  3. Anagrafiche (requisiti §3): anche gli Operatori censiscono e
--     modificano Organizzazioni ed Enti di Validazione.
--  4. Consultazione pubblica (requisiti §6): l'apertura passa da una
--     funzione che rende pubblico il documento; il documento in
--     consultazione è bloccato (si sostituisce solo con l'errata corrige);
--     ogni osservazione ha un numero progressivo («Osservazione n. 3»); il
--     Comune riceve una notifica quando un'osservazione è ammessa.
--  5. Conservazione per 10 anni (requisiti §12): nessuno cancella più
--     pratiche, fasi, consultazioni, integrazioni, pagamenti, organizzazioni,
--     enti o file dei documenti; le pratiche chiuse o annullate riportano
--     la data fino a cui vanno conservate. Le fasi e le pratiche si
--     modificano solo con le funzioni che chiedono la motivazione.
--  6. Il Comune non carica documenti in una fase completata o non ancora
--     aperta (requisiti §4: l'integrazione termina con la chiusura della
--     fase); restano ammessi i documenti generali della pratica.
--  7. Notifica di apertura della fase 1 alla creazione della pratica.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. RAPPORTI DI MONITORAGGIO: 4 FASI E DURATE PER TIPO DI PRATICA
-- ---------------------------------------------------------------------
-- durata_fase (script 13) aveva una riga per numero di fase (1-7, solo
-- Progetti). Ora la chiave è (tipo_pratica, numero).
alter table durata_fase add column if not exists tipo_pratica tipo_pratica not null default 'progetto';

do $$
declare v_nome text;
begin
  -- Toglie il vecchio vincolo di unicità sul solo numero.
  for v_nome in
    select conname from pg_constraint
     where conrelid = 'durata_fase'::regclass and contype = 'u'
       and conkey = array[(select attnum from pg_attribute
                            where attrelid = 'durata_fase'::regclass and attname = 'numero')]
  loop
    execute format('alter table durata_fase drop constraint %I', v_nome);
  end loop;
end $$;
create unique index if not exists uq_durata_fase_tipo_numero on durata_fase (tipo_pratica, numero);

-- Durate iniziali del Rapporto (giorni): la fase 1 è l'avvio.
insert into durata_fase (tipo_pratica, numero, nome, giorni) values
  ('rapporto', 1, 'Caricamento del rapporto', 0),
  ('rapporto', 2, 'Verifica documentale', 10),
  ('rapporto', 3, 'Validazione e verifica', 75),
  ('rapporto', 4, 'Chiusura', 15)
on conflict (tipo_pratica, numero) do nothing;

-- Numero di fasi del percorso di ciascun tipo di pratica.
create or replace function cwp_numero_fasi(p_tipo tipo_pratica)
returns int
language sql immutable as $$
  select case p_tipo when 'rapporto' then 4 else 7 end;
$$;

-- Durata (giorni) di una fase per tipo di pratica.
create or replace function cwp_durata_fase(p_tipo tipo_pratica, p_numero int)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select giorni from durata_fase where tipo_pratica = p_tipo and numero = p_numero), 0);
$$;

-- Versione precedente (solo numero): vale per i Progetti.
create or replace function cwp_durata_fase(p_numero int)
returns int
language sql stable security definer set search_path = public as $$
  select cwp_durata_fase('progetto'::tipo_pratica, p_numero);
$$;

-- Apertura di una fase (ridefinita dallo script 08): la durata dipende ora
-- dal tipo di pratica. Controlli invariati.
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
  update fase
     set stato = 'in_corso',
         data_apertura = current_date,
         data_prevista_chiusura = coalesce(data_prevista_chiusura, current_date + cwp_durata_fase(v_tipo, numero)),
         aggiornato_il = now()
   where id = p_fase;
end $$;

-- Modifica di una durata (solo Amministratori, motivazione obbligatoria,
-- audit). Sostituisce la versione a 3 parametri dello script 13, che resta
-- come scorciatoia per i Progetti.
create or replace function admin_imposta_durata_fase(p_tipo tipo_pratica, p_numero int, p_giorni int, p_motivazione text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_prima int; v_nome text; v_id uuid; v_motivazione text;
begin
  if not app_is_admin() then
    raise exception 'Operazione riservata agli amministratori';
  end if;
  v_motivazione := cwp_richiedi_motivazione(p_motivazione);
  if p_numero = 1 then
    raise exception 'La fase 1 è il giorno di avvio e non ha durata';
  end if;
  if p_numero not between 2 and cwp_numero_fasi(p_tipo) then
    raise exception 'Fase non valida: il percorso di questo tipo di pratica ha % fasi', cwp_numero_fasi(p_tipo);
  end if;
  if p_giorni is null or p_giorni not between 0 and 365 then
    raise exception 'La durata deve essere tra 0 e 365 giorni';
  end if;

  select id, giorni, nome into v_id, v_prima, v_nome
    from durata_fase where tipo_pratica = p_tipo and numero = p_numero;
  if v_id is null then raise exception 'Fase non trovata'; end if;
  if v_prima = p_giorni then return; end if;

  update durata_fase
     set giorni = p_giorni, aggiornato_il = now(), aggiornato_da = auth.uid()
   where id = v_id;

  insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, oggetto_id,
                           stato_precedente, stato_successivo, motivazione, dettaglio)
  values (auth.uid(), app_ruolo(), 'modifica durata fase', 'durata_fase', v_id,
          initcap(p_tipo::text) || ' · ' || v_nome || ' / ' || v_prima || ' giorni',
          initcap(p_tipo::text) || ' · ' || v_nome || ' / ' || p_giorni || ' giorni',
          v_motivazione, jsonb_build_object('tipo', p_tipo, 'numero', p_numero, 'da', v_prima, 'a', p_giorni));
end $$;
revoke all on function admin_imposta_durata_fase(tipo_pratica, int, int, text) from public, anon;
grant execute on function admin_imposta_durata_fase(tipo_pratica, int, int, text) to authenticated;

create or replace function admin_imposta_durata_fase(p_numero int, p_giorni int, p_motivazione text)
returns void
language sql security definer set search_path = public as $$
  select admin_imposta_durata_fase('progetto'::tipo_pratica, p_numero, p_giorni, p_motivazione);
$$;

-- Nuova pratica con le sue fasi (ridefinita dallo script 20): il numero di
-- fasi dipende dal tipo (Progetto 7, Rapporto 4).
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

  insert into pratica (tipo, organizzazione_id, codice, titolo, stato, progetto_padre_id, anno_monitoraggio)
  select r.tipo, r.organizzazione_id, nullif(trim(r.codice), ''), r.titolo,
         coalesce(r.stato, 'attiva'), r.progetto_padre_id, r.anno_monitoraggio
  from jsonb_populate_record(null::pratica, p_pratica) r
  returning * into v_pratica;

  insert into fase (pratica_id, numero, nome, responsabile, stato)
  select v_pratica.id, f.numero, f.nome, f.responsabile, coalesce(f.stato, 'non_iniziata')
  from jsonb_populate_recordset(null::fase, p_fasi) f;

  return v_pratica;
end $$;
grant execute on function staff_crea_pratica(jsonb, jsonb) to authenticated;

-- Modelli di documento (script 17): un modello legato a una fase vale per
-- un tipo di pratica (la fase 3 del Progetto non è la fase 3 del Rapporto).
alter table modello_documento add column if not exists tipo_pratica tipo_pratica;
update modello_documento set tipo_pratica = 'progetto' where fase_numero is not null and tipo_pratica is null;


-- ---------------------------------------------------------------------
-- 2. DOCUMENTI RICHIESTI PER FASE
-- ---------------------------------------------------------------------
-- Una riga = una tipologia di documento (src/lib/cwpProgram.js,
-- TIPOLOGIE_DOCUMENTO) attesa in una fase di un tipo di pratica. La fase
-- risulta «completa» per quella voce se contiene almeno un documento
-- corrente con quella tipologia (calcolo nel portale, DettaglioPratica).
create table if not exists documento_richiesto (
  id            uuid primary key default gen_random_uuid(),
  tipo_pratica  tipo_pratica not null,
  fase_numero   int not null check (fase_numero between 1 and 7),
  tipologia     text not null check (length(trim(tipologia)) > 0),
  descrizione   text,
  attivo        boolean not null default true,
  creato_da     uuid references auth.users(id) on delete set null default auth.uid(),
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  unique (tipo_pratica, fase_numero, tipologia)
);

alter table documento_richiesto enable row level security;
drop policy if exists richiesto_select on documento_richiesto;
create policy richiesto_select on documento_richiesto for select
  using (auth.uid() is not null);
drop policy if exists richiesto_insert on documento_richiesto;
create policy richiesto_insert on documento_richiesto for insert
  with check (app_is_admin());
drop policy if exists richiesto_update on documento_richiesto;
create policy richiesto_update on documento_richiesto for update
  using (app_is_admin()) with check (app_is_admin());
-- Nessuna cancellazione: una voce si disattiva (attivo = false).

drop trigger if exists trg_audit on documento_richiesto;
create trigger trg_audit after insert or update on documento_richiesto
  for each row execute function audit_registra();


-- ---------------------------------------------------------------------
-- 3. ANAGRAFICHE: ORGANIZZAZIONI ED ENTI ANCHE PER GLI OPERATORI
-- ---------------------------------------------------------------------
drop policy if exists org_write on organizzazione;
drop policy if exists org_insert on organizzazione;
drop policy if exists org_update on organizzazione;
create policy org_insert on organizzazione for insert with check (app_is_staff());
create policy org_update on organizzazione for update using (app_is_staff()) with check (app_is_staff());

drop policy if exists ente_write on ente_validazione;
drop policy if exists ente_insert on ente_validazione;
drop policy if exists ente_update on ente_validazione;
create policy ente_insert on ente_validazione for insert with check (app_is_staff());
create policy ente_update on ente_validazione for update using (app_is_staff()) with check (app_is_staff());


-- ---------------------------------------------------------------------
-- 4. CONSULTAZIONE PUBBLICA
-- ---------------------------------------------------------------------
-- 4a. Apertura: solo da questa funzione. Il documento scelto diventa
-- pubblico e resta bloccato finché la consultazione è attiva (4c).
-- Date in ora italiana (database in Europe/Rome, script 20): dal giorno di
-- apertura al giorno + 30 compreso.
create or replace function staff_apri_consultazione(p_pratica uuid, p_documento uuid)
returns consultazione
language plpgsql security definer set search_path = public as $$
declare p pratica; c consultazione;
begin
  perform cwp_richiedi_staff();
  select * into p from pratica where id = p_pratica;
  if p.id is null then raise exception 'Pratica non trovata'; end if;
  if p.tipo <> 'progetto' then
    raise exception 'La consultazione pubblica riguarda solo i Progetti';
  end if;
  if p.stato <> 'attiva' then
    raise exception 'La pratica non è attiva';
  end if;
  if exists (select 1 from consultazione where pratica_id = p_pratica and attiva) then
    raise exception 'C''è già una consultazione attiva per questa pratica';
  end if;
  if not exists (select 1 from documento where id = p_documento and pratica_id = p_pratica) then
    raise exception 'Il documento non appartiene a questa pratica';
  end if;

  update documento set pubblico = true where id = p_documento and not pubblico;
  insert into consultazione (pratica_id, documento_id, data_apertura, data_chiusura, attiva)
  values (p_pratica, p_documento, current_date, current_date + 30, true)
  returning * into c;
  return c;
end $$;
grant execute on function staff_apri_consultazione(uuid, uuid) to authenticated;

-- 4b. Chiusura: solo da questa funzione (prima era una scrittura diretta).
create or replace function staff_chiudi_consultazione(p_consultazione uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform cwp_richiedi_staff();
  update consultazione set attiva = false where id = p_consultazione and attiva;
  if not found then raise exception 'Consultazione non trovata o già chiusa'; end if;
end $$;
grant execute on function staff_chiudi_consultazione(uuid) to authenticated;

-- Nessuna scrittura diretta sulla consultazione: apertura, chiusura ed
-- errata corrige (staff_errata_corrige, script 17) passano dalle funzioni.
drop policy if exists consult_write on consultazione;

-- 4c. Documento bloccato: finché la consultazione è attiva, il documento
-- in consultazione e quelli delle errata corrige non cambiano visibilità,
-- tipologia o fase. Restano possibili i cambi automatici di corrente/stato
-- quando si carica una nuova versione (07_correzioni_sicurezza.sql).
create or replace function documento_bloccato_in_consultazione()
returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.pubblico is distinct from old.pubblico
      or new.visibile_cliente is distinct from old.visibile_cliente
      or new.visibile_fondazione is distinct from old.visibile_fondazione
      or new.tipologia is distinct from old.tipologia
      or new.fase_id is distinct from old.fase_id)
     and (exists (select 1 from consultazione c where c.documento_id = old.id and c.attiva)
          or exists (select 1 from consultazione_errata e join consultazione c on c.id = e.consultazione_id
                      where e.documento_id = old.id and c.attiva))
     -- l'errata corrige e l'apertura rendono pubblico il documento: ammesso
     and not (new.pubblico and not old.pubblico
              and new.visibile_cliente is not distinct from old.visibile_cliente
              and new.visibile_fondazione is not distinct from old.visibile_fondazione
              and new.tipologia is not distinct from old.tipologia
              and new.fase_id is not distinct from old.fase_id) then
    raise exception 'Il documento è pubblicato in una consultazione attiva: non si modifica (per sostituirlo usa l''errata corrige)';
  end if;
  return new;
end $$;

drop trigger if exists trg_documento_bloccato on documento;
create trigger trg_documento_bloccato before update on documento
  for each row execute function documento_bloccato_in_consultazione();

-- 4d. Numero progressivo delle osservazioni per consultazione.
alter table commento add column if not exists numero int;
do $$
begin
  update commento c set numero = n.rn
    from (select id, row_number() over (partition by consultazione_id order by creato_il, id) rn from commento) n
   where n.id = c.id and c.numero is null;
end $$;
create unique index if not exists uq_commento_numero on commento (consultazione_id, numero);
grant select (numero) on commento to authenticated;

create or replace function commento_numero()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Un'osservazione alla volta per consultazione (evita numeri doppi).
  perform pg_advisory_xact_lock(hashtext('commento_numero:' || new.consultazione_id::text));
  select coalesce(max(numero), 0) + 1 into new.numero from commento where consultazione_id = new.consultazione_id;
  return new;
end $$;

drop trigger if exists trg_commento_numero on commento;
create trigger trg_commento_numero before insert on commento
  for each row execute function commento_numero();


-- ---------------------------------------------------------------------
-- 5. CONSERVAZIONE PER 10 ANNI: NIENTE CANCELLAZIONI
-- ---------------------------------------------------------------------
-- Pratiche e fasi: lo staff le crea (staff_crea_pratica); le modifiche
-- passano solo dalle funzioni con motivazione e audit (staff_apri_fase,
-- staff_chiudi_fase, staff_modifica_scadenza, staff_cambia_stato_pratica,
-- staff_imposta_ente_validazione…). Nessuno le cancella.
drop policy if exists pratica_write on pratica;
drop policy if exists pratica_insert on pratica;
create policy pratica_insert on pratica for insert with check (app_is_staff());

drop policy if exists fase_write on fase;
drop policy if exists fase_insert on fase;
create policy fase_insert on fase for insert with check (app_is_staff());

-- Integrazioni: solo dalle funzioni dello script 08.
drop policy if exists integr_write on richiesta_integrazione;

-- Pagamenti: lo staff inserisce e modifica, nessuno cancella.
drop policy if exists pagamento_write on pagamento;
drop policy if exists pagamento_insert on pagamento;
drop policy if exists pagamento_update on pagamento;
create policy pagamento_insert on pagamento for insert with check (app_is_staff());
create policy pagamento_update on pagamento for update using (app_is_staff()) with check (app_is_staff());

-- File dei documenti: mai sovrascritti; si cancella solo un file rimasto
-- orfano (registrazione del documento non riuscita), da chi l'ha caricato
-- o dallo staff.
drop policy if exists documenti_update on storage.objects;
drop policy if exists documenti_delete on storage.objects;
create policy documenti_delete on storage.objects for delete
  using (
    bucket_id = 'documenti'
    and (app_is_staff() or owner_id = auth.uid()::text)
    and not exists (select 1 from public.documento d where d.storage_path = storage.objects.name)
  );

-- Data fino a cui conservare la pratica: chiusura o annullamento + 10 anni.
-- Si azzera se la pratica viene riattivata.
alter table pratica add column if not exists conservare_fino_al date;

create or replace function pratica_conservazione()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stato in ('chiusa', 'annullata') and old.stato not in ('chiusa', 'annullata') then
    new.conservare_fino_al := (current_date + interval '10 years')::date;
  elsif new.stato in ('attiva', 'sospesa') then
    new.conservare_fino_al := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_pratica_conservazione on pratica;
create trigger trg_pratica_conservazione before update on pratica
  for each row execute function pratica_conservazione();

update pratica set conservare_fino_al = (aggiornato_il::date + interval '10 years')::date
 where stato in ('chiusa', 'annullata') and conservare_fino_al is null;


-- ---------------------------------------------------------------------
-- 6. IL COMUNE CARICA SOLO NELLE FASI APERTE
-- ---------------------------------------------------------------------
create or replace function fase_aperta(p_fase uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from fase where id = p_fase and stato in ('in_corso', 'in_attesa_integrazione'));
$$;

drop policy if exists doc_insert on documento;
create policy doc_insert on documento for insert
  with check (
    app_is_staff()
    or (pratica_mia(pratica_id) and pratica_attiva(pratica_id)
        and (fase_id is null or fase_aperta(fase_id)))
  );


-- ---------------------------------------------------------------------
-- 7. AUDIT E NOTIFICHE (funzioni dello script 17 ridefinite)
-- ---------------------------------------------------------------------
-- audit_registra: aggiunte le voci dei documenti richiesti. Il resto è
-- identico allo script 17.
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
  if tg_op = 'UPDATE' then
    for v_chiave in select jsonb_object_keys(v_new) loop
      if v_new -> v_chiave is distinct from v_old -> v_chiave
         and v_chiave not in ('aggiornato_il') then
        v_diff := v_diff || jsonb_build_object(
          v_chiave, jsonb_build_object('da', v_old -> v_chiave, 'a', v_new -> v_chiave));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then
      return null;
    end if;
    if tg_table_name = 'documento'
       and (select bool_and(k in ('corrente','stato')) from jsonb_object_keys(v_diff) k) then
      return null;
    end if;
  end if;

  if tg_table_name = 'utente_organizzazione' then
    v_oggetto := (v_rec ->> 'utente_id')::uuid;
  else
    v_oggetto := (v_rec ->> 'id')::uuid;
  end if;
  v_pratica := case
    when tg_table_name = 'pratica' then v_oggetto
    when v_rec ? 'pratica_id' then (v_rec ->> 'pratica_id')::uuid
  end;

  v_etichetta := case when tg_table_name = 'fase' then (v_rec ->> 'nome') || ' / ' else '' end;
  if v_old ? 'stato' then v_prec := v_etichetta || upper(replace(v_old ->> 'stato', '_', ' ')); end if;
  if v_new ? 'stato' then v_succ := v_etichetta || upper(replace(v_new ->> 'stato', '_', ' ')); end if;

  v_motivazione := coalesce(v_new ->> 'motivazione_stato', v_new ->> 'motivazione_moderazione');
  if tg_op = 'UPDATE'
     and not (v_diff ? 'motivazione_stato' or v_diff ? 'motivazione_moderazione' or v_diff ? 'stato') then
    v_motivazione := null;
  end if;
  v_motivazione := coalesce(nullif(current_setting('cwp.motivazione', true), ''), v_motivazione);

  v_op := case tg_table_name
    when 'pratica' then case
      when tg_op = 'INSERT' then 'creazione ' || coalesce(v_new ->> 'tipo', 'pratica')
      when v_diff ? 'stato' then 'cambio stato pratica'
      when v_diff ? 'ente_validazione_id' then 'assegnazione ente di validazione'
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
      when v_diff ? 'data_chiusura' then 'proroga consultazione pubblica'
      else 'modifica consultazione' end
    when 'commento' then case
      when tg_op = 'INSERT' then 'ricezione commento'
      when v_diff ? 'risposta_testo' then 'risposta a commento'
      when v_diff ? 'stato' then 'moderazione commento'
      else 'modifica commento' end
    when 'consultazione_errata' then 'errata corrige in consultazione'
    when 'richiesta_integrazione' then case
      when tg_op = 'INSERT' then 'richiesta di integrazione'
      when v_diff ? 'risolta' and (v_new ->> 'risolta')::boolean then 'integrazione completata'
      when v_diff ? 'documento_risposta_id' then 'risposta del cliente a integrazione'
      else 'modifica richiesta di integrazione' end
    when 'pagamento' then case
      when tg_op = 'INSERT' then 'registrazione voce di pagamento'
      when v_diff ? 'pagato' and (v_new ->> 'pagato')::boolean then 'registrazione incasso'
      else 'modifica pagamento' end
    when 'nota_fase' then case when (v_new ->> 'visibile_cliente')::boolean
      then 'nota di fase condivisa con il cliente' else 'nota di fase interna' end
    when 'messaggio' then 'messaggio nella pratica'
    when 'modello_documento' then case
      when tg_op = 'INSERT' then 'pubblicazione modello di documento'
      when v_diff ? 'attivo' and not (v_new ->> 'attivo')::boolean then 'ritiro modello di documento'
      else 'modifica modello di documento' end
    when 'documento_richiesto' then case
      when tg_op = 'INSERT' then 'aggiunta documento richiesto'
      when v_diff ? 'attivo' and not (v_new ->> 'attivo')::boolean then 'rimozione documento richiesto'
      else 'modifica documento richiesto' end
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
    case when tg_op = 'UPDATE' then v_diff
         -- i dati dell'autore di un'osservazione non finiscono nel dettaglio
         when tg_table_name = 'commento' then v_rec - 'autore_email' - 'autore_nome'
         else v_rec end
  );
  return null;
end $$;

-- notifiche_eventi: aggiunte l'apertura della fase 1 alla creazione della
-- pratica e l'osservazione ammessa (al Comune). Il resto è identico allo
-- script 17; i trigger trg_notifiche esistenti richiamano questa funzione.
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
    -- Fase 1 creata già «in corso» insieme alla pratica (script 21).
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
    -- Osservazione ammessa: il Comune deve rispondere (script 21).
    elsif new.stato = 'pubblicato' and old.stato = 'ricevuto' then
      perform cwp_notifica(v_clienti, v_pratica, 'commento_ammesso',
        'Nuova osservazione a cui rispondere',
        v_etichetta || ' — Osservazione n. ' || coalesce(new.numero::text, '?'));
    end if;

  elsif tg_table_name = 'consultazione_errata' then
    perform cwp_notifica(v_clienti, v_pratica, 'errata_corrige',
      'Errata corrige pubblicata in consultazione',
      v_etichetta || case when new.riparte
        then ' — la consultazione riparte: nuova chiusura ' || to_char(new.nuova_chiusura, 'DD/MM/YYYY')
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
        'Pratica ' || case new.stato when 'attiva' then 'riattivata' when 'sospesa' then 'sospesa'
                                     when 'annullata' then 'annullata' else 'chiusa' end,
        v_etichetta || coalesce(' — ' || new.motivazione_stato, ''));
    end if;
  end if;
  return null;
end $$;
