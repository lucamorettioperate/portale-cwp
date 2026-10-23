-- =====================================================================
--  42 — DASHBOARD: VALORE COMPLESSIVO DEI CREDITI
--
--  Scopo (richiesta di Luca Moretti del 23/10/2026): due nuovi indicatori
--   - crediti IN SIMULAZIONE: scenari del simulatore;
--   - crediti IN FASE ESECUTIVA: calcoli ex post confermati e crediti
--     emessi in lotti (con le vendite comunicate dal registro).
--  Gli Amministratori (e gli Operatori, che vedono già scenari e lotti)
--  vedono i totali di tutto il portale; gli utenti dei Comuni solo quelli
--  delle proprie organizzazioni e pratiche, senza il dettaglio. Valori in
--  crediti (tCO₂eq) e in euro (scelta di Luca: «crediti ed euro»).
--
--  Regole (scelte predefinite, Luca senza preferenza il 23/10):
--   - simulazione: per ogni Comune conta SOLO lo scenario aggiornato più
--     di recente (gli scenari «prudente / obiettivo / ambizioso» sono
--     alternative, non si sommano); crediti netti su tutto il periodo
--     simulato (7, 10 o 21 anni); euro = ricavi dello scenario (crediti ×
--     valore del credito anno per anno, nuova colonna ricavi_totali salvata
--     dal simulatore). Gli scenari salvati prima di oggi o senza valore del
--     credito si valorizzano al prezzo di riferimento (punto 2) e il numero
--     di questi scenari è restituito a parte, così la pagina lo dice;
--   - esecutiva: crediti netti dei calcoli ex post confermati e ancora
--     validi (non sostituiti da una nuova versione confermata, come nel
--     registro dei crediti, script 18) e crediti emessi nei lotti (script
--     24); euro = crediti × prezzo di riferimento, più il valore effettivo
--     delle vendite comunicate (credito_vendita.valore_vendita).
--
--   1. scenario_simulazione.ricavi_totali (numeric, euro del periodo).
--   2. Impostazione prezzo_credito_riferimento (€ per credito, iniziale 32
--      come il valore proposto dal simulatore), modificata dall'Amministratore
--      con admin_imposta_prezzo_riferimento (voce di audit).
--   3. cruscotto_valore_crediti(): JSON con i totali per chi chiama.
--
--  Nessun dato esistente cambia. Eseguire DOPO lo script 41, nel SQL
--  Editor di Supabase. Si può rieseguire senza danni.
--  Prove su banco isolato: t42.sql. Registro sviluppo e deploy: capitolo
--  «Database», script 42; capitolo 15 «Calcolo crediti».
-- =====================================================================

-- 1. Ricavi dello scenario (salvati dal simulatore insieme ai crediti).
alter table scenario_simulazione add column if not exists ricavi_totali numeric;

-- 2. Prezzo di riferimento del credito.
insert into impostazione (chiave, valore) values ('prezzo_credito_riferimento', '32')
on conflict (chiave) do nothing;

create or replace function admin_imposta_prezzo_riferimento(p_prezzo numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare v_prima text;
begin
  if not app_is_admin() then raise exception 'Operazione riservata agli amministratori'; end if;
  if p_prezzo is null or p_prezzo < 0 or p_prezzo > 10000 then
    raise exception 'Indica un prezzo del credito tra 0 e 10.000 €';
  end if;
  select valore into v_prima from impostazione where chiave = 'prezzo_credito_riferimento';
  insert into impostazione (chiave, valore, aggiornato_il) values ('prezzo_credito_riferimento', round(p_prezzo, 2)::text, now())
  on conflict (chiave) do update set valore = excluded.valore, aggiornato_il = now();
  insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, stato_precedente, stato_successivo)
  values (auth.uid(), app_ruolo(), 'modifica prezzo di riferimento del credito', 'impostazione',
          coalesce(v_prima, ''), round(p_prezzo, 2)::text);
end $$;
revoke execute on function admin_imposta_prezzo_riferimento(numeric) from public, anon;
grant execute on function admin_imposta_prezzo_riferimento(numeric) to authenticated;

-- 3. Totali per la Dashboard e per «Le mie pratiche».
-- Ambito: «tutti» per lo staff; «propri» per gli utenti dei Comuni
-- (organizzazioni dell'utente: app_org_mia; pratiche: della propria
-- organizzazione). Senza accesso valido: eccezione.
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

  -- Simulazione: lo scenario più recente per ogni Comune (organizzazione
  -- censita oppure, per i Comuni non ancora aderenti, il nome scritto).
  with scelti as (
    select distinct on (coalesce(s.organizzazione_id::text, 'nome:' || lower(trim(s.comune))))
           s.crediti_netti_totali, s.ricavi_totali
      from scenario_simulazione s
     where s.crediti_netti_totali is not null
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
revoke execute on function cruscotto_valore_crediti() from public, anon;
grant execute on function cruscotto_valore_crediti() to authenticated;

-- Verifica rapida: colonna, impostazione e funzioni presenti.
select (select count(*) from information_schema.columns
         where table_name = 'scenario_simulazione' and column_name = 'ricavi_totali') as colonna_ricavi,
       (select valore from impostazione where chiave = 'prezzo_credito_riferimento') as prezzo_riferimento,
       (select count(*) from pg_proc where proname in ('cruscotto_valore_crediti', 'admin_imposta_prezzo_riferimento')) as funzioni;
