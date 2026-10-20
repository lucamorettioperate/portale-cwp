-- =====================================================================
--  35 — CONTROLLI DEI DATI DAL COLLAUDO V01 (20/10/2026)
--
--  Scopo: ripetere nel database i controlli aggiunti nel portale dopo il
--  primo rapporto di collaudo (Andrea Valentini, Albina Ambrogio, Andrea
--  Pavan, Gianluca Tapparini, Luca Belfiore). Anche se il portale avesse
--  un errore, il database non accetta più:
--   D07 — pesi, volumi, svuotamenti, pezzi negativi nella Banca Dati
--         Utenze (calcolo_conferimento, calcolo_riuso);
--   D02 — buffer fuori da 0-80% e crediti negativi in un calcolo salvato;
--   D01/D02/D03 — scenari del simulatore con popolazione, produzione o
--         secco impossibili, buffer fuori da 0-80%, valori economici
--         negativi o non numerici;
--   R05 — conferma di un calcolo senza Banca Dati Utenze o con un
--         risultato «bloccato» (dati non ammessi).
--  Le date inesistenti (D04, es. 31/02) le rifiuta già il tipo «date»
--  della colonna calcolo_crediti.data_avvio.
--
--  I DATI GIÀ SALVATI NON SI TOCCANO: i vincoli sono «NOT VALID», cioè
--  valgono per ogni nuova riga o modifica ma non controllano né cambiano le
--  righe esistenti. L'ultima istruzione CONTA (solo lettura) i dati già
--  salvati che non rispetterebbero le nuove regole, per decidere insieme
--  se e come riesaminarli: nessuna correzione automatica.
--
--  Eseguire DOPO lo script 34, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 35; capitolo
--  «Collaudo»; test/collaudo_v01.test.mjs.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. BANCA DATI UTENZE: NIENTE VALORI NEGATIVI (D07)
-- ---------------------------------------------------------------------
-- Vuoto (null) resta ammesso; n_utenze deve essere maggiore di zero.
alter table calcolo_conferimento drop constraint if exists calcolo_conferimento_non_negativi;
alter table calcolo_conferimento add constraint calcolo_conferimento_non_negativi check (
  coalesce(svuotamenti, 0) >= 0 and coalesce(volume, 0) >= 0
  and coalesce(peso_strutture, 0) >= 0 and coalesce(volume_strutture, 0) >= 0
  and coalesce(peso_cdr, 0) >= 0 and coalesce(volume_cdr, 0) >= 0
  and n_utenze > 0
) not valid;

alter table calcolo_riuso drop constraint if exists calcolo_riuso_non_negativi;
alter table calcolo_riuso add constraint calcolo_riuso_non_negativi check (
  coalesce(pezzi, 0) >= 0 and coalesce(peso, 0) >= 0 and n_utenze > 0
) not valid;


-- ---------------------------------------------------------------------
-- 2. CALCOLO DEI CREDITI: BUFFER 0-80% E CREDITI NON NEGATIVI (D02)
-- ---------------------------------------------------------------------
alter table calcolo_crediti drop constraint if exists calcolo_crediti_valori_ammessi;
alter table calcolo_crediti add constraint calcolo_crediti_valori_ammessi check (
  (buffer_pct is null or buffer_pct between 0 and 80)
  and coalesce(crediti_lordi, 0) >= 0 and coalesce(crediti_netti, 0) >= 0
) not valid;

-- Conferma (R05): servono righe nella Banca Dati Utenze e un risultato
-- senza errori bloccanti. Gira insieme a calcolo_coerenza (script 20):
-- un errore annulla tutta l'operazione.
create or replace function calcolo_prerequisiti_conferma()
returns trigger
language plpgsql set search_path = public as $$
begin
  if old.stato = 'bozza' and new.stato = 'confermato' then
    if not exists (select 1 from calcolo_conferimento where calcolo_id = new.id) then
      raise exception 'Non si può confermare un calcolo senza Banca Dati Utenze (conferimenti delle utenze): importala e premi «Calcola»';
    end if;
    if new.risultato is not null
       and (coalesce((new.risultato ->> 'bloccato')::boolean, false)
            or jsonb_array_length(coalesce(new.risultato -> 'errori', '[]'::jsonb)) > 0) then
      raise exception 'Non si può confermare: il risultato ha errori bloccanti (dati non ammessi). Correggi i dati e premi «Calcola»';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_calcolo_prerequisiti on calcolo_crediti;
create trigger trg_calcolo_prerequisiti before update on calcolo_crediti
  for each row execute function calcolo_prerequisiti_conferma();


-- ---------------------------------------------------------------------
-- 3. SCENARI DEL SIMULATORE: DATI FISICAMENTE POSSIBILI (D01, D02, D03)
-- ---------------------------------------------------------------------
-- Numero da un valore JSON (numero o testo, anche con la virgola).
-- Restituisce null se il valore manca o è vuoto; 'NaN' se non è un numero.
create or replace function cwp_numero_json(p jsonb)
returns numeric
language plpgsql immutable set search_path = public as $$
declare v text;
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  v := trim(both from (case when jsonb_typeof(p) = 'string' then p #>> '{}' else p::text end));
  if v = '' then return null; end if;
  v := replace(v, ',', '.');
  if v !~ '^[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then return 'NaN'::numeric; end if;
  return v::numeric;
end $$;

-- Controllo dei dati dello scenario: stesse regole di erroriScenario()
-- (src/lib/crediti/simulatore.js). Vuoto = non indicato; zero è un valore.
create or replace function scenario_valida()
returns trigger
language plpgsql set search_path = public as $$
declare
  d jsonb := coalesce(new.dati, '{}'::jsonb);
  a jsonb;
  k text;
  v jsonb;
  n numeric;
begin
  -- Buffer: se presente deve essere 0-80 (vuoto non ammesso).
  if d ? 'bufferPct' then
    n := cwp_numero_json(d -> 'bufferPct');
    if n is null or n = 'NaN' or n < 0 or n > 80 then
      raise exception 'Scenario non salvato: il buffer deve essere un numero tra 0 e 80%% (ora «%»)', coalesce(d ->> 'bufferPct', '');
    end if;
  end if;

  -- Popolazione e rifiuti dello scenario di riferimento.
  n := cwp_numero_json(d -> 'annoBase' -> 'popolazione');
  if n = 'NaN' or n <= 0 then
    raise exception 'Scenario non salvato: la popolazione dello scenario di riferimento deve essere maggiore di zero';
  end if;
  for k, v in select * from jsonb_each(coalesce(d -> 'annoBase' -> 'rifiuti', '{}'::jsonb)) loop
    n := cwp_numero_json(v);
    if n = 'NaN' or n < 0 then
      raise exception 'Scenario non salvato: i rifiuti di riferimento «%» non possono essere negativi o non numerici', k;
    end if;
  end loop;

  -- Situazione attuale (facoltativa).
  n := cwp_numero_json(d -> 'attuale' -> 'popolazione');
  if n = 'NaN' or n <= 0 then raise exception 'Scenario non salvato: la popolazione attuale deve essere maggiore di zero'; end if;
  n := cwp_numero_json(d -> 'attuale' -> 'proCapite');
  if n = 'NaN' or n <= 0 then raise exception 'Scenario non salvato: la produzione pro capite attuale deve essere maggiore di zero'; end if;
  n := cwp_numero_json(d -> 'attuale' -> 'seccoProCapite');
  if n = 'NaN' or n < 0 then raise exception 'Scenario non salvato: il secco pro capite attuale non può essere negativo'; end if;

  -- Obiettivi anno per anno.
  for a in select * from jsonb_array_elements(case when jsonb_typeof(d -> 'anni') = 'array' then d -> 'anni' else '[]'::jsonb end) loop
    n := cwp_numero_json(a -> 'popolazione');
    if n = 'NaN' or n <= 0 then
      raise exception 'Scenario non salvato: anno %, la popolazione deve essere maggiore di zero', a ->> 'anno';
    end if;
    n := cwp_numero_json(a -> 'totale');
    if n = 'NaN' or n <= 0 then
      raise exception 'Scenario non salvato: anno %, la produzione totale deve essere maggiore di zero', a ->> 'anno';
    end if;
    n := cwp_numero_json(a -> 'seccoProCapite');
    if n = 'NaN' or n < 0 then
      raise exception 'Scenario non salvato: anno %, il secco pro capite non può essere negativo', a ->> 'anno';
    end if;
  end loop;

  -- Parte economica: valori del credito e costi non negativi.
  for k in select unnest(array['prezzo', 'prezzoMin', 'prezzoMax', 'costoValidazione', 'costoVerificaAnnua', 'altriCostiAnnui']) loop
    n := cwp_numero_json(d -> 'economia' -> k);
    if n = 'NaN' or n < 0 then
      raise exception 'Scenario non salvato: il valore economico «%» non può essere negativo o non numerico', k;
    end if;
  end loop;
  for k, v in select * from jsonb_each(case when jsonb_typeof(d -> 'economia' -> 'prezzi') = 'object' then d -> 'economia' -> 'prezzi' else '{}'::jsonb end) loop
    n := cwp_numero_json(v);
    if n = 'NaN' or n < 0 then
      raise exception 'Scenario non salvato: il valore del credito per il % non può essere negativo o non numerico', k;
    end if;
  end loop;
  n := cwp_numero_json(d -> 'economia' -> 'crescitaPrezzo');
  if n = 'NaN' or n < -100 then
    raise exception 'Scenario non salvato: la variazione annua del valore del credito non può essere sotto il −100%%';
  end if;

  return new;
end $$;

drop trigger if exists trg_scenario_valida on scenario_simulazione;
create trigger trg_scenario_valida before insert or update on scenario_simulazione
  for each row execute function scenario_valida();


-- ---------------------------------------------------------------------
-- 4. VERIFICA E DATI GIÀ SALVATI DA RIESAMINARE (solo lettura)
-- ---------------------------------------------------------------------
-- Conta i dati salvati prima di questo script che non rispettano le nuove
-- regole. Nessuna modifica: il riesame va deciso a parte (rapporto di
-- collaudo V01, punto 9).
select 'conferimenti con valori negativi' as controllo,
       count(*) as righe,
       count(distinct calcolo_id) as calcoli
  from calcolo_conferimento
 where not (coalesce(svuotamenti, 0) >= 0 and coalesce(volume, 0) >= 0
            and coalesce(peso_strutture, 0) >= 0 and coalesce(volume_strutture, 0) >= 0
            and coalesce(peso_cdr, 0) >= 0 and coalesce(volume_cdr, 0) >= 0 and n_utenze > 0)
union all
select 'riuso con valori negativi', count(*), count(distinct calcolo_id)
  from calcolo_riuso
 where not (coalesce(pezzi, 0) >= 0 and coalesce(peso, 0) >= 0 and n_utenze > 0)
union all
select 'calcoli con buffer fuori 0-80% o crediti negativi', count(*), count(*)
  from calcolo_crediti
 where not ((buffer_pct is null or buffer_pct between 0 and 80)
            and coalesce(crediti_lordi, 0) >= 0 and coalesce(crediti_netti, 0) >= 0)
union all
select 'calcoli confermati senza Banca Dati Utenze', count(*), count(*)
  from calcolo_crediti c
 where c.stato = 'confermato'
   and not exists (select 1 from calcolo_conferimento f where f.calcolo_id = c.id)
union all
select 'scenari con buffer oltre 80% o non numerico', count(*), count(*)
  from scenario_simulazione
 where dati ? 'bufferPct'
   and (cwp_numero_json(dati -> 'bufferPct') is null or cwp_numero_json(dati -> 'bufferPct') = 'NaN'
        or cwp_numero_json(dati -> 'bufferPct') not between 0 and 80);
