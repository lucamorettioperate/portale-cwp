-- =====================================================================
--  39 — FEEDBACK PUBBLICO ALLINEATO ALLA FASE 3 E ENTE PRIMA DELLA FASE 5
--
--  Scopo: correzioni dei rilievi N02 e N03 (terza sessione di collaudo,
--  CWP_NUOVI_RILIEVI_A_MORETTI_V01_20261021, risposte in
--  docs/collaudo/Rilievi_N01-N06_risposte.md).
--
--  N02 — chiusura anticipata del feedback pubblico (Guida 6.2.2 e
--  Tabella 3: 30 giorni solari per il Progetto, 20 per il Rapporto,
--  durata della fase 3 modificabile dall'Admin). Prima la chiusura non
--  controllava la data e la fase 3 si chiudeva indipendentemente dalla
--  consultazione. Ora:
--   a) staff_chiudi_consultazione: chiusura ORDINARIA solo dal giorno
--      dopo data_chiusura (ultimo giorno compreso, ora italiana). Prima
--      del termine si chiude solo se la pratica è annullata, ritirata o
--      chiusa, con motivazione obbligatoria (tipo «pratica_non_attiva»).
--      Nessun'altra eccezione: la Guida non prevede chiusure anticipate
--      (domanda aperta alla Fondazione, ATTESA_REGOLA). Tipo, ora e
--      motivazione della chiusura restano sulla consultazione e nell'audit.
--   b) staff_chiudi_fase sulla fase 3: con un feedback ancora aperto nel
--      periodo è rifiutata; senza nessun feedback aperto è rifiutata; con
--      il periodo finito chiude anche il feedback (stesso procedimento).
--   c) chiusura ordinaria del feedback = completamento della fase 3, se
--      è aperta.
--   d) staff_apri_consultazione: rifiutata se la fase 3 è già completata;
--      apre la fase 3 se non è iniziata (con i controlli di staff_apri_fase)
--      e ne allinea la scadenza al termine del feedback.
--   e) trigger: se il termine cambia (errata corrige con ripartenza), la
--      scadenza della fase 3 aperta lo segue (anche per il rilievo N04).
--  N03 — fase 5 senza ente: staff_apri_fase rifiuta la fase 5 (Progetto:
--  validazione; Rapporto: verifica) se la pratica non ha un ente di
--  validazione e verifica attivo assegnato (Guida 6.2.3: l'attività è
--  dell'ente incaricato); staff_imposta_ente_validazione non toglie l'ente
--  mentre la fase 5 è aperta. Il contratto con l'ente resta fuori dal
--  portale (dati del contratto: ATTESA_REGOLA).
--
--  Dati storici: lo script NON modifica consultazioni, fasi o audit
--  esistenti (Borgoval resta com'è). Le nuove colonne sono vuote per le
--  chiusure passate.
--
--  Eseguire DOPO lo script 38, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 39.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Oggi in Italia (il database è già in Europe/Rome, script 20: qui lo
--    si dichiara per non dipendere dall'impostazione).
-- ---------------------------------------------------------------------
create or replace function cwp_oggi()
returns date
language sql stable as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- ---------------------------------------------------------------------
-- 1. Traccia della chiusura del feedback pubblico.
-- ---------------------------------------------------------------------
alter table consultazione add column if not exists chiusa_il timestamptz;
alter table consultazione add column if not exists chiusura_tipo text;
alter table consultazione add column if not exists motivazione_chiusura text;
alter table consultazione drop constraint if exists chk_chiusura_tipo;
alter table consultazione add constraint chk_chiusura_tipo
  check (chiusura_tipo is null or chiusura_tipo in ('ordinaria', 'pratica_non_attiva'));

-- ---------------------------------------------------------------------
-- 2. Chiusura del feedback pubblico (N02 a e c).
--    La vecchia firma a un parametro si elimina: due firme renderebbero
--    ambigua la chiamata del portale.
-- ---------------------------------------------------------------------
drop function if exists staff_chiudi_consultazione(uuid);

create or replace function staff_chiudi_consultazione(p_consultazione uuid, p_motivazione text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare c consultazione; v_stato stato_pratica; v_tipo text; v_mot text;
begin
  perform cwp_richiedi_staff();
  select * into c from consultazione where id = p_consultazione;
  if c.id is null or not c.attiva then
    raise exception 'Feedback pubblico non trovato o già chiuso';
  end if;
  select stato into v_stato from pratica where id = c.pratica_id;
  v_mot := nullif(trim(coalesce(p_motivazione, '')), '');

  if c.data_chiusura is null or cwp_oggi() > c.data_chiusura then
    v_tipo := 'ordinaria';
    if v_mot is not null then perform set_config('cwp.motivazione', v_mot, true); end if;
  elsif v_stato in ('annullata', 'ritirata', 'chiusa') then
    -- Procedimento finito: il feedback si chiude prima del termine, motivato.
    perform cwp_richiedi_motivazione(p_motivazione);
    v_tipo := 'pratica_non_attiva';
  else
    raise exception 'Il feedback pubblico resta aperto fino al % compreso (Guida 6.2.2 e Tabella 3): si chiude dal giorno successivo',
      to_char(c.data_chiusura, 'DD/MM/YYYY');
  end if;

  update consultazione
     set attiva = false, chiusa_il = now(), chiusura_tipo = v_tipo, motivazione_chiusura = v_mot
   where id = c.id;

  -- Chiusura ordinaria = fine della fase 3 (stesso procedimento).
  if v_tipo = 'ordinaria' then
    update fase
       set stato = 'completata', data_effettiva_chiusura = cwp_oggi(), aggiornato_il = now()
     where pratica_id = c.pratica_id and numero = 3
       and stato in ('in_corso', 'in_attesa_integrazione');
  end if;
end $$;
revoke execute on function staff_chiudi_consultazione(uuid, text) from public, anon;
grant execute on function staff_chiudi_consultazione(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Chiusura di una fase (N02 b). Uguale alla versione dello script 08
--    più il controllo della fase 3.
-- ---------------------------------------------------------------------
create or replace function staff_chiudi_fase(p_fase uuid, p_motivazione text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare f fase; v_aperte int; c consultazione;
begin
  perform cwp_richiedi_staff();
  select * into f from fase where id = p_fase;
  if f.id is null then raise exception 'Fase non trovata'; end if;
  if f.stato not in ('in_corso', 'in_attesa_integrazione') then
    raise exception 'Si può chiudere solo una fase aperta';
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
  update fase
     set stato = 'completata',
         data_effettiva_chiusura = current_date,
         aggiornato_il = now()
   where id = p_fase;
end $$;
grant execute on function staff_chiudi_fase(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Apertura di una fase (N03). Uguale alla versione dello script 23
--    più l'ente obbligatorio per la fase 5.
-- ---------------------------------------------------------------------
create or replace function staff_apri_fase(p_fase uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare f fase; v_stato_pratica stato_pratica; v_tipo tipo_pratica; v_ente uuid;
begin
  perform cwp_richiedi_staff();
  select * into f from fase where id = p_fase;
  if f.id is null then raise exception 'Fase non trovata'; end if;
  select stato, tipo, ente_validazione_id into v_stato_pratica, v_tipo, v_ente from pratica where id = f.pratica_id;
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
  -- N03: la validazione (o la verifica del Rapporto) la svolge l'ente
  -- incaricato: senza un ente attivo assegnato la fase 5 non parte.
  if f.numero = 5 and not exists (select 1 from ente_validazione where id = v_ente and attivo) then
    raise exception 'Assegna l''ente di validazione e verifica alla pratica prima di aprire la fase 5 (Guida 6.2.3: l''attività è svolta dall''ente incaricato)';
  end if;
  update fase
     set stato = 'in_corso',
         data_apertura = current_date,
         data_prevista_chiusura = coalesce(data_prevista_chiusura, current_date + cwp_durata_fase(v_tipo, numero)),
         aggiornato_il = now()
   where id = p_fase;
end $$;
grant execute on function staff_apri_fase(uuid) to authenticated;

-- L'ente non si toglie mentre la fase 5 è aperta (si può sostituire).
create or replace function staff_imposta_ente_validazione(p_pratica uuid, p_ente uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform cwp_richiedi_staff();
  if p_ente is not null and not exists (select 1 from ente_validazione where id = p_ente and attivo) then
    raise exception 'Ente di Validazione non trovato o non attivo';
  end if;
  if p_ente is null and exists (select 1 from fase where pratica_id = p_pratica and numero = 5
                                   and stato in ('in_corso', 'in_attesa_integrazione')) then
    raise exception 'La fase 5 è aperta: l''ente si può sostituire ma non togliere';
  end if;
  update pratica set ente_validazione_id = p_ente, aggiornato_il = now() where id = p_pratica;
  if not found then raise exception 'Pratica non trovata'; end if;
end $$;
grant execute on function staff_imposta_ente_validazione(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Apertura del feedback pubblico (N02 d). Uguale alla versione dello
--    script 23 più il legame con la fase 3.
-- ---------------------------------------------------------------------
create or replace function staff_apri_consultazione(p_pratica uuid, p_documento uuid)
returns consultazione
language plpgsql security definer set search_path = public as $$
declare p pratica; c consultazione; f3 fase;
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
  select * into f3 from fase where pratica_id = p_pratica and numero = 3;
  if f3.stato = 'completata' then
    raise exception 'La fase 3 (feedback pubblico) è già completata: non si apre un nuovo feedback';
  end if;
  -- La fase 3 parte con il feedback (stessi controlli dell'apertura manuale).
  if f3.id is not null and f3.stato = 'non_iniziata' then
    perform staff_apri_fase(f3.id);
  end if;

  update documento set pubblico = true where id = p_documento and not pubblico;
  insert into consultazione (pratica_id, documento_id, data_apertura, data_chiusura, attiva)
  values (p_pratica, p_documento, current_date, current_date + cwp_giorni_feedback(p.tipo), true)
  returning * into c;
  -- La scadenza della fase 3 è il termine del feedback (trigger del punto 6).
  return c;
end $$;
grant execute on function staff_apri_consultazione(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Scadenza della fase 3 = termine del feedback (N02 e, N04).
-- ---------------------------------------------------------------------
create or replace function consultazione_scadenza_fase3()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.attiva and new.data_chiusura is not null
     and (tg_op = 'INSERT' or new.data_chiusura is distinct from old.data_chiusura) then
    update fase
       set data_prevista_chiusura = new.data_chiusura, aggiornato_il = now()
     where pratica_id = new.pratica_id and numero = 3
       and stato in ('in_corso', 'in_attesa_integrazione')
       and data_prevista_chiusura is distinct from new.data_chiusura;
  end if;
  return new;
end $$;

drop trigger if exists trg_consultazione_scadenza_fase3 on consultazione;
create trigger trg_consultazione_scadenza_fase3
  after insert or update of data_chiusura on consultazione
  for each row execute function consultazione_scadenza_fase3();

-- Verifica (solo lettura): le funzioni aggiornate.
select proname, pg_get_function_identity_arguments(oid) as argomenti
  from pg_proc
 where proname in ('staff_chiudi_consultazione', 'staff_chiudi_fase', 'staff_apri_fase',
                   'staff_apri_consultazione', 'staff_imposta_ente_validazione', 'cwp_oggi')
 order by proname;
