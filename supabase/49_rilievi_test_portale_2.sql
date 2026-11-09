-- =====================================================================
--  49 — RILIEVI «TEST_PORTALE_CWP_2» (secondo collaudo, 9/11/2026)
--
--  Correzioni dei rilievi nuovi del documento TEST_PORTALE_CWP_2 mandato
--  da Luca Moretti il 9/11/2026 (risposte nel documento di progetto
--  claude/test-portale-cwp-2-risposte.md):
--
--   1. Sei fasi come nella Guida (T32, che completa T01): la registrazione
--      del Progetto (e del Rapporto con i suoi crediti) è l'esito della
--      fase 6, la verifica documentale (Guida 6.2.4 e 6.3.1); l'emissione
--      dei crediti segue la registrazione del Rapporto (Guida 6.3.2) dal
--      riquadro «Crediti emessi». La fase 7 («Registrazione del progetto»
--      / «Emissione dei crediti», 0 giorni) non è prevista e si toglie:
--      - le pratiche nuove nascono con 6 fasi (cwp_numero_fasi = 6);
--      - durata della fase 7 tolta; documenti richiesti e modelli della
--        fase 7, se ce ne sono, passano alla fase 6;
--      - nelle pratiche esistenti la fase 7 si cancella solo se è vuota
--        (nessun documento, nota o richiesta di integrazione); la
--        cancellazione resta nell'audit con la motivazione. Una fase 7 con
--        contenuti resta com'è (il portale la mostra come «non più
--        prevista») e il controllo finale la conta.
--   2. Scenari del simulatore salvati con regole precedenti (T33):
--      colonna «ammesso»; uno scenario con l'anno di riferimento fuori dal
--      64-66% di differenziata (Standard 4.8.1, rilievo T10) non è
--      ammesso; la Dashboard (crediti e valore dei progetti in
--      simulazione) somma solo gli scenari ammessi. La data «Aggiornato»
--      cambia solo quando cambiano gli input, non quando si riallineano i
--      totali (pulsante «Aggiorna i totali salvati» del Simulatore).
--
--  I punti T34 (risultati non aggiornati nei calcoli già salvati) e la nota
--  su «Avvio del progetto» (T20) sono solo nel portale.
--
--  Rieseguibile. Prova: t49.sql sul banco locale.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Sei fasi (T32)
-- ---------------------------------------------------------------------
create or replace function cwp_numero_fasi(p_tipo tipo_pratica)
returns int
language sql immutable as $$
  -- Progetto e Rapporto hanno lo stesso percorso di 6 fasi (Guida 6.2 e
  -- 6.3.1): la registrazione è l'esito della fase 6 (script 49).
  select 6;
$$;

-- Documenti richiesti e modelli legati alla fase 7: passano alla fase 6.
update documento_richiesto set fase_numero = 6 where fase_numero = 7;
update modello_documento set fase_numero = 6 where fase_numero = 7;
delete from durata_fase where numero = 7;

alter table durata_fase drop constraint if exists durata_fase_numero_check;
alter table durata_fase add constraint durata_fase_numero_check check (numero between 1 and 6);
alter table documento_richiesto drop constraint if exists documento_richiesto_fase_numero_check;
alter table documento_richiesto add constraint documento_richiesto_fase_numero_check check (fase_numero between 1 and 6);
alter table modello_documento drop constraint if exists modello_documento_fase_numero_check;
alter table modello_documento add constraint modello_documento_fase_numero_check check (fase_numero between 1 and 6);

-- Fasi 7 vuote delle pratiche esistenti: si cancellano, con la motivazione
-- nell'audit (trigger audit_registra).
do $$
begin
  perform set_config('cwp.motivazione',
    'Secondo collaudo (9/11/2026): la Guida prevede 6 fasi, la registrazione è l''esito della fase 6 (Guida 6.2.4 e 6.3.1); fase 7 vuota tolta (script 49)', true);
  delete from fase f
   where f.numero = 7
     and not exists (select 1 from documento d where d.fase_id = f.id)
     and not exists (select 1 from nota_fase n where n.fase_id = f.id)
     and not exists (select 1 from richiesta_integrazione r where r.fase_id = f.id);
  perform set_config('cwp.motivazione', '', true);
end $$;

-- Una fase 7 rimasta non si apre più (stessa funzione dello script 39 con
-- un controllo in più).
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
  -- Script 49: la Guida prevede 6 fasi; una fase 7 rimasta (con contenuti)
  -- non si apre più.
  if f.numero > cwp_numero_fasi(v_tipo) then
    raise exception 'La fase % non è più prevista: il percorso ha % fasi e la registrazione è l''esito della fase 6 (Guida 6.2.4 e 6.3.1)', f.numero, cwp_numero_fasi(v_tipo);
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

-- ---------------------------------------------------------------------
-- 2. Scenari del simulatore ammessi (T33)
-- ---------------------------------------------------------------------
alter table scenario_simulazione add column if not exists ammesso boolean not null default true;

-- Differenziata dello scenario di riferimento (%), come rdRifiuti() in
-- src/lib/crediti/simulatore.js: (totale − secco) / totale, contando solo
-- le quantità positive; null se mancano totale o secco.
create or replace function cwp_rd_riferimento_scenario(p_dati jsonb)
returns numeric
language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; n numeric; v_tot numeric := 0; v_secco numeric := 0;
begin
  for k, v in select * from jsonb_each(case when jsonb_typeof(p_dati -> 'annoBase' -> 'rifiuti') = 'object' then p_dati -> 'annoBase' -> 'rifiuti' else '{}'::jsonb end) loop
    n := cwp_numero_json(v);
    if n is null or n = 'NaN' or n <= 0 then continue; end if;
    v_tot := v_tot + n;
    if k = 'indifferenziato' then v_secco := v_secco + n; end if;
  end loop;
  if v_tot <= 0 or v_secco <= 0 then return null; end if;
  return (v_tot - v_secco) / v_tot * 100;
end $$;

-- Vero se il riferimento rispetta lo Standard 4.8.1: anno con il 64-66%
-- di differenziata oppure valori medi del cluster (usati così come sono).
create or replace function cwp_scenario_riferimento_ammesso(p_dati jsonb)
returns boolean
language sql immutable set search_path = public as $$
  select coalesce(p_dati -> 'annoBase' ->> 'metodo', 'anno') <> 'anno'
      or coalesce((p_dati ->> 'riferimentoAllaSoglia')::boolean, false)
      or cwp_rd_riferimento_scenario(p_dati) is null
      or cwp_rd_riferimento_scenario(p_dati) between 64 - 1e-9 and 66 + 1e-9;
$$;

-- Trigger di controllo dello scenario (script 35): se il riferimento non è
-- ammesso lo scenario resta salvabile solo come «non ammesso» (il portale
-- comunque non lo salva; serve a segnare quelli salvati prima).
create or replace function scenario_ammesso()
returns trigger
language plpgsql set search_path = public as $$
begin
  if not cwp_scenario_riferimento_ammesso(new.dati) then
    new.ammesso := false;
  end if;
  return new;
end $$;
drop trigger if exists trg_scenario_ammesso on scenario_simulazione;
create trigger trg_scenario_ammesso before insert or update on scenario_simulazione
  for each row execute function scenario_ammesso();

-- «Aggiornato» cambia solo quando cambiano gli input dello scenario, non
-- quando si riallineano i totali di riepilogo.
create or replace function scenario_aggiornato()
returns trigger
language plpgsql as $$
begin
  if new.dati is distinct from old.dati or new.nome is distinct from old.nome
     or new.note is distinct from old.note or new.durata is distinct from old.durata
     or new.anno_inizio is distinct from old.anno_inizio or new.comune is distinct from old.comune
     or new.organizzazione_id is distinct from old.organizzazione_id then
    new.aggiornato_il := now();
  end if;
  return new;
end $$;

-- Scenari già salvati con il riferimento fuori dal 64-66%.
update scenario_simulazione set ammesso = false
 where ammesso and not cwp_scenario_riferimento_ammesso(dati);

-- Dashboard: crediti in simulazione (script 42) e valore dei progetti in
-- simulazione (script 43) solo con gli scenari ammessi.
create or replace function cruscotto_valore_crediti()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_staff boolean := app_is_staff();
  v_prezzo numeric;
  v_sim jsonb;
  v_calc jsonb;
  v_lotti jsonb;
  v_vend jsonb;
begin
  if auth.uid() is null or app_ruolo() is null then
    raise exception 'Accesso richiesto';
  end if;
  select coalesce(nullif(valore, '')::numeric, 32) into v_prezzo
    from impostazione where chiave = 'prezzo_credito_riferimento';
  v_prezzo := coalesce(v_prezzo, 32);

  -- Simulazione: lo scenario ammesso più recente per ogni Comune (organizzazione
  -- censita oppure, per i Comuni non ancora aderenti, il nome scritto).
  with scelti as (
    select distinct on (coalesce(s.organizzazione_id::text, 'nome:' || lower(trim(s.comune))))
           s.crediti_netti_totali, s.ricavi_totali
      from scenario_simulazione s
     where s.crediti_netti_totali is not null
       and s.ammesso  -- script 49: solo gli scenari ammessi oggi
       and (v_staff or (s.organizzazione_id is not null and app_org_mia(s.organizzazione_id)))
     order by coalesce(s.organizzazione_id::text, 'nome:' || lower(trim(s.comune))), s.aggiornato_il desc
  )
  select jsonb_build_object(
           'comuni', count(*),
           'crediti', coalesce(sum(crediti_netti_totali), 0),
           'euro', coalesce(sum(coalesce(ricavi_totali, crediti_netti_totali * v_prezzo)), 0),
           'a_prezzo_riferimento', count(*) filter (where ricavi_totali is null))
    into v_sim from scelti;

  -- Calcoli ex post confermati e ancora validi.
  select jsonb_build_object(
           'calcoli', count(*),
           'crediti', coalesce(sum(c.crediti_netti), 0))
    into v_calc
    from calcolo_crediti c
    join pratica p on p.id = c.pratica_id
   where c.stato = 'confermato' and c.tipo = 'ex_post'
     and not exists (select 1 from calcolo_crediti n where n.versione_di = c.id and n.stato = 'confermato')
     and (v_staff or app_org_mia(p.organizzazione_id));

  -- Lotti di crediti emessi.
  select jsonb_build_object('lotti', count(*), 'crediti', coalesce(sum(l.quantita), 0))
    into v_lotti
    from credito_lotto l
    join pratica p on p.id = l.rapporto_id
   where v_staff or app_org_mia(p.organizzazione_id);

  -- Vendite comunicate dal registro (valore effettivo, se indicato).
  select jsonb_build_object(
           'crediti', coalesce(sum(v.quantita), 0),
           'euro', coalesce(sum(v.valore_vendita), 0),
           'senza_valore', count(*) filter (where v.valore_vendita is null))
    into v_vend
    from credito_vendita v
    join pratica p on p.id = v.pratica_id
   where v_staff or app_org_mia(p.organizzazione_id);

  return jsonb_build_object(
    'ambito', case when v_staff then 'tutti' else 'propri' end,
    'prezzo_riferimento', v_prezzo,
    'simulazione', v_sim,
    'calcolati', v_calc || jsonb_build_object('euro', (v_calc ->> 'crediti')::numeric * v_prezzo),
    'emessi', v_lotti || jsonb_build_object('euro', (v_lotti ->> 'crediti')::numeric * v_prezzo),
    'venduti', v_vend);
end $$;

create or replace function cruscotto_valore_progetti()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_staff boolean := app_is_staff();
  v_sim jsonb;
  v_prog jsonb;
begin
  if auth.uid() is null or app_ruolo() is null then
    raise exception 'Accesso richiesto';
  end if;

  -- Simulazione: stesso scenario dello script 42 (il più recente per Comune).
  with scelti as (
    select distinct on (coalesce(s.organizzazione_id::text, 'nome:' || lower(trim(s.comune))))
           s.costo_cliente_totale
      from scenario_simulazione s
     where s.crediti_netti_totali is not null
       and s.ammesso  -- script 49: solo gli scenari ammessi oggi
       and (v_staff or (s.organizzazione_id is not null and app_org_mia(s.organizzazione_id)))
     order by coalesce(s.organizzazione_id::text, 'nome:' || lower(trim(s.comune))), s.aggiornato_il desc
  )
  select jsonb_build_object(
           'comuni', count(*),
           'euro', coalesce(sum(costo_cliente_totale), 0),
           'senza_caso', count(*) filter (where costo_cliente_totale is null))
    into v_sim from scelti;

  -- Progetti aperti (non annullati né ritirati).
  select coalesce(jsonb_agg(jsonb_build_object(
           'codice', p.codice, 'caso', p.caso_listino, 'popolazione', p.popolazione,
           'periodo', p.periodo_riferimento, 'stato', p.stato) order by p.codice), '[]'::jsonb)
    into v_prog
    from pratica p
   where p.tipo = 'progetto' and p.stato not in ('annullata', 'ritirata')
     and (v_staff or app_org_mia(p.organizzazione_id));

  return jsonb_build_object('ambito', case when v_staff then 'tutti' else 'propri' end,
                            'simulazione', v_sim, 'progetti', v_prog);
end $$;

revoke execute on function cruscotto_valore_crediti() from public, anon;
grant execute on function cruscotto_valore_crediti() to authenticated;
revoke execute on function cruscotto_valore_progetti() from public, anon;
grant execute on function cruscotto_valore_progetti() to authenticated;

-- Controllo finale (sola lettura): fasi 7 rimaste (con contenuti), durate
-- della fase 7, scenari non ammessi.
select (select count(*) from fase where numero = 7) as fasi_7_rimaste,
       (select count(*) from durata_fase where numero = 7) as durate_fase_7,
       (select count(*) from scenario_simulazione where not ammesso) as scenari_non_ammessi,
       cwp_numero_fasi('progetto') as fasi_del_percorso;
