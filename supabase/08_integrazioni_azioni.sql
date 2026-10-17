-- =====================================================================
--  INTEGRAZIONI E AZIONI DEL BACK-OFFICE (requisiti §4 e §8)
--  Eseguire DOPO 07_correzioni_sicurezza.sql, nel SQL Editor di Supabase.
--  Lo script è rieseguibile.
--
--  1. Motivazione delle azioni manuali registrata nell'audit.
--  2. Fasi: apertura (con scadenza calcolata dai giorni del Programma),
--     chiusura, modifica scadenza con motivazione obbligatoria.
--  3. Pratica: cambio stato (attiva / sospesa / annullata / chiusa) con
--     motivazione obbligatoria.
--  4. Richieste di integrazione: l'Operatore richiede → la fase passa
--     IN ATTESA DI INTEGRAZIONE → il Cliente carica il documento e
--     risponde → l'Operatore chiude la richiesta → se non restano
--     richieste aperte la fase torna IN CORSO. Con la chiusura della
--     fase la possibilità di integrare termina.
--  5. Sulle pratiche sospese, annullate o chiuse il Cliente non carica
--     documenti e non risponde.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. AUDIT: motivazione dichiarata dall'azione in corso
-- ---------------------------------------------------------------------
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

  -- Motivazione: quella dichiarata dall'azione in corso (impostata dalle
  -- funzioni del back-office con set_config('cwp.motivazione', ...)),
  -- altrimenti quella registrata sul record, se pertinente.
  v_motivazione := coalesce(v_new ->> 'motivazione_stato', v_new ->> 'motivazione_moderazione');
  if tg_op = 'UPDATE'
     and not (v_diff ? 'motivazione_stato' or v_diff ? 'motivazione_moderazione' or v_diff ? 'stato') then
    v_motivazione := null;
  end if;
  v_motivazione := coalesce(nullif(current_setting('cwp.motivazione', true), ''), v_motivazione);

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
      when v_diff ? 'documento_risposta_id' then 'risposta del cliente a integrazione'
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

-- Helper interni.
create or replace function cwp_richiedi_staff()
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_staff() then
    raise exception 'Operazione riservata al back-office';
  end if;
end $$;

create or replace function cwp_richiedi_motivazione(p_motivazione text)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if p_motivazione is null or length(trim(p_motivazione)) < 3 then
    raise exception 'La motivazione è obbligatoria';
  end if;
  -- resta valida solo per la transazione corrente (letta dall'audit)
  perform set_config('cwp.motivazione', trim(p_motivazione), true);
  return trim(p_motivazione);
end $$;


-- ---------------------------------------------------------------------
-- 2. FASI
-- ---------------------------------------------------------------------
-- Durata indicativa di ciascuna fase in giorni (infografica: 0, 10, 40,
-- 60, 135, 150). Da confermare (requisiti §16, punto C).
create or replace function cwp_durata_fase(p_numero int)
returns int
language sql immutable as $$
  select case p_numero
    when 2 then 10   -- Prima verifica documentale: 0 → 10
    when 3 then 30   -- Consultazione pubblica: 10 → 40
    when 4 then 20   -- Risposta ai commenti / pubblicazione: 40 → 60
    when 5 then 75   -- Validazione e verifica: 60 → 135
    when 6 then 15   -- Seconda verifica documentale: 135 → 150
    else 0           -- Adesione (giorno 0), Chiusura (giorno 150)
  end;
$$;

create or replace function staff_apri_fase(p_fase uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare f fase; v_stato_pratica stato_pratica;
begin
  perform cwp_richiedi_staff();
  select * into f from fase where id = p_fase;
  if f.id is null then raise exception 'Fase non trovata'; end if;
  select stato into v_stato_pratica from pratica where id = f.pratica_id;
  if v_stato_pratica <> 'attiva' then
    raise exception 'La pratica non è attiva: riattivala prima di aprire una fase';
  end if;
  if f.stato <> 'non_iniziata' then
    raise exception 'La fase è già stata aperta';
  end if;
  update fase
     set stato = 'in_corso',
         data_apertura = current_date,
         data_prevista_chiusura = coalesce(data_prevista_chiusura, current_date + cwp_durata_fase(numero)),
         aggiornato_il = now()
   where id = p_fase;
end $$;

create or replace function staff_chiudi_fase(p_fase uuid, p_motivazione text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare f fase; v_aperte int;
begin
  perform cwp_richiedi_staff();
  select * into f from fase where id = p_fase;
  if f.id is null then raise exception 'Fase non trovata'; end if;
  if f.stato not in ('in_corso', 'in_attesa_integrazione') then
    raise exception 'Si può chiudere solo una fase aperta';
  end if;
  -- Con integrazioni ancora aperte la chiusura è un'eccezione: va motivata.
  select count(*) into v_aperte from richiesta_integrazione
   where fase_id = p_fase and not risolta;
  if v_aperte > 0 then
    perform cwp_richiedi_motivazione(p_motivazione);
  elsif p_motivazione is not null and length(trim(p_motivazione)) > 0 then
    perform set_config('cwp.motivazione', trim(p_motivazione), true);
  end if;
  update fase
     set stato = 'completata',
         data_effettiva_chiusura = current_date,
         aggiornato_il = now()
   where id = p_fase;
end $$;

create or replace function staff_modifica_scadenza(p_fase uuid, p_data date, p_motivazione text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform cwp_richiedi_staff();
  perform cwp_richiedi_motivazione(p_motivazione);
  if p_data is null then raise exception 'Indica la nuova scadenza'; end if;
  update fase
     set data_prevista_chiusura = p_data, aggiornato_il = now()
   where id = p_fase and stato <> 'completata';
  if not found then
    raise exception 'Fase non trovata o già completata';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. STATO DELLA PRATICA
-- ---------------------------------------------------------------------
create or replace function staff_cambia_stato_pratica(p_pratica uuid, p_stato stato_pratica, p_motivazione text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_mot text; v_attuale stato_pratica;
begin
  perform cwp_richiedi_staff();
  v_mot := cwp_richiedi_motivazione(p_motivazione);
  select stato into v_attuale from pratica where id = p_pratica;
  if v_attuale is null then raise exception 'Pratica non trovata'; end if;
  if v_attuale = p_stato then raise exception 'La pratica è già in questo stato'; end if;
  if v_attuale = 'annullata' then
    raise exception 'Una pratica annullata non può cambiare stato';
  end if;
  update pratica
     set stato = p_stato, motivazione_stato = v_mot, aggiornato_il = now()
   where id = p_pratica;
end $$;


-- ---------------------------------------------------------------------
-- 4. RICHIESTE DI INTEGRAZIONE
-- ---------------------------------------------------------------------
alter table richiesta_integrazione add column if not exists risposto_il timestamptz;
alter table richiesta_integrazione add column if not exists nota_risposta text;
alter table richiesta_integrazione add column if not exists risolta_il timestamptz;

create or replace function staff_richiedi_integrazione(p_fase uuid, p_descrizione text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare f fase; v_id uuid; v_stato_pratica stato_pratica;
begin
  perform cwp_richiedi_staff();
  if p_descrizione is null or length(trim(p_descrizione)) < 3 then
    raise exception 'Descrivi cosa deve integrare il Cliente';
  end if;
  select * into f from fase where id = p_fase;
  if f.id is null then raise exception 'Fase non trovata'; end if;
  if f.stato not in ('in_corso', 'in_attesa_integrazione') then
    raise exception 'Le integrazioni si chiedono solo su una fase aperta';
  end if;
  select stato into v_stato_pratica from pratica where id = f.pratica_id;
  if v_stato_pratica <> 'attiva' then
    raise exception 'La pratica non è attiva';
  end if;
  insert into richiesta_integrazione (fase_id, pratica_id, descrizione, richiesta_da)
  values (p_fase, f.pratica_id, trim(p_descrizione), auth.uid())
  returning id into v_id;
  update fase set stato = 'in_attesa_integrazione', aggiornato_il = now()
   where id = p_fase and stato <> 'in_attesa_integrazione';
  return v_id;
end $$;

create or replace function cliente_rispondi_integrazione(p_richiesta uuid, p_documento uuid, p_nota text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare r richiesta_integrazione; v_fase stato_fase; v_stato_pratica stato_pratica;
begin
  select * into r from richiesta_integrazione where id = p_richiesta;
  if r.id is null or not pratica_mia(r.pratica_id) then
    raise exception 'Richiesta non trovata o non accessibile';
  end if;
  if r.risolta then raise exception 'La richiesta è già stata chiusa'; end if;
  select stato into v_fase from fase where id = r.fase_id;
  if v_fase = 'completata' then
    raise exception 'La fase è chiusa: non è più possibile integrare';
  end if;
  select stato into v_stato_pratica from pratica where id = r.pratica_id;
  if v_stato_pratica <> 'attiva' then raise exception 'La pratica non è attiva'; end if;
  if not exists (select 1 from documento where id = p_documento and pratica_id = r.pratica_id) then
    raise exception 'Il documento non appartiene a questa pratica';
  end if;
  update richiesta_integrazione
     set documento_risposta_id = p_documento,
         risposto_il = now(),
         nota_risposta = nullif(trim(coalesce(p_nota, '')), '')
   where id = p_richiesta;
end $$;

create or replace function staff_chiudi_integrazione(p_richiesta uuid, p_motivazione text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare r richiesta_integrazione;
begin
  perform cwp_richiedi_staff();
  select * into r from richiesta_integrazione where id = p_richiesta;
  if r.id is null then raise exception 'Richiesta non trovata'; end if;
  if r.risolta then raise exception 'La richiesta è già chiusa'; end if;
  -- Chiudere senza che il Cliente abbia risposto è un'eccezione: va motivata.
  if r.documento_risposta_id is null then
    perform cwp_richiedi_motivazione(p_motivazione);
  end if;
  update richiesta_integrazione
     set risolta = true, risolta_il = now()
   where id = p_richiesta;
  -- Nessuna altra richiesta aperta: la fase torna IN CORSO.
  if not exists (select 1 from richiesta_integrazione
                  where fase_id = r.fase_id and not risolta) then
    update fase set stato = 'in_corso', aggiornato_il = now()
     where id = r.fase_id and stato = 'in_attesa_integrazione';
  end if;
end $$;

grant execute on function staff_apri_fase(uuid) to authenticated;
grant execute on function staff_chiudi_fase(uuid, text) to authenticated;
grant execute on function staff_modifica_scadenza(uuid, date, text) to authenticated;
grant execute on function staff_cambia_stato_pratica(uuid, stato_pratica, text) to authenticated;
grant execute on function staff_richiedi_integrazione(uuid, text) to authenticated;
grant execute on function cliente_rispondi_integrazione(uuid, uuid, text) to authenticated;
grant execute on function staff_chiudi_integrazione(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. CLIENTE: niente caricamenti su pratiche non attive
-- ---------------------------------------------------------------------
create or replace function pratica_attiva(p_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pratica where id = p_id and stato = 'attiva');
$$;

drop policy if exists doc_insert on documento;
create policy doc_insert on documento for insert
  with check (app_is_staff() or (pratica_mia(pratica_id) and pratica_attiva(pratica_id)));
