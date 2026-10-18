-- =====================================================================
--  RINFORZI DI INTEGRITÀ (backlog 33, 18/10/2026)
--  Eseguire DOPO 19_correzioni_revisione_codice.sql. Lo script è
--  rieseguibile. Registro sviluppo e deploy: capitolo «Database» e
--  punto 33 del backlog.
--
--  1. Data italiana. Il database ragiona in ora italiana (Europe/Rome):
--     «oggi» per le scadenze delle fasi, delle consultazioni e dei
--     pagamenti è la data italiana, non quella UTC (prima, tra mezzanotte
--     e le 2 di notte, il database era ancora al giorno prima).
--  2. Nuova pratica tutta insieme. staff_crea_pratica crea la pratica e
--     le sue 7 fasi in un'unica operazione: o tutto o niente. Prima erano
--     due scritture separate e una pratica poteva restare senza fasi.
--  3. Modifica di un utente tutta insieme. admin_aggiorna_utente_completo
--     cambia ruolo e organizzazioni in un'unica operazione.
--  4. Calcolo dei crediti, coerenza del risultato:
--     a) se cambiano i dati di un calcolo in bozza (dati, anno, tipo, data
--        di avvio) senza un nuovo risultato, il risultato salvato si
--        azzera: va ripremuto «Calcola». Prima si poteva salvare dati
--        nuovi e confermare il risultato vecchio;
--     b) lo stesso se cambia la Banca Dati Utenze (conferimenti o riuso);
--     c) alla conferma il database controlla che le righe salvate della
--        Banca Dati Utenze siano quante quelle usate nel calcolo (il
--        portale le scrive in risultato.righe). Così un salvataggio
--        interrotto a metà non si può confermare;
--     d) admin_nuova_versione_calcolo copia calcolo e Banca Dati Utenze in
--        un'unica operazione (prima in più passaggi dal browser).
--  5. Password temporanea: finché l'utente non l'ha cambiata, il database
--     non gli riconosce ruolo né organizzazione, quindi non vede né scrive
--     dati del portale (può solo leggere il proprio profilo e cambiare la
--     password). Prima l'obbligo lo imponeva solo l'interfaccia.
--
--  Il limite di 10 Rapporti di Monitoraggio per Progetto è già garantito
--  dal database (vincolo chk_anno_range e indice uq_rapporto_anno dello
--  script 01, sequenza degli anni nel trigger trg_rapporto_coerente dello
--  script 09): nessuna modifica.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. DATA ITALIANA
-- ---------------------------------------------------------------------
-- Vale per le nuove connessioni al database (portale, funzioni, job
-- pianificati). Le date salvate non cambiano; cambia solo il «giorno di
-- oggi» (current_date) e il modo in cui le ore sono mostrate. Gli orari
-- dei job pg_cron restano in UTC (sono impostati a parte).
do $$
begin
  execute format('alter database %I set timezone to %L', current_database(), 'Europe/Rome');
end $$;
set timezone to 'Europe/Rome';


-- ---------------------------------------------------------------------
-- 2. NUOVA PRATICA CON LE SUE FASI (un'unica operazione)
-- ---------------------------------------------------------------------
-- p_pratica: colonne della pratica (tipo, organizzazione_id, codice,
--   titolo, stato, progetto_padre_id, anno_monitoraggio); le altre sono
--   ignorate. Codice e organizzazione dei Rapporti li completano i trigger
--   già esistenti (trg_pratica_codice, trg_rapporto_coerente).
-- p_fasi: le 7 fasi standard (numero, nome, responsabile, stato), dal
--   portale (src/lib/cwpProgram.js, FASI).
-- Gira con i permessi di chi la chiama (security invoker): valgono le
-- stesse regole RLS di prima (pratica_write e fase_write: solo staff).
create or replace function staff_crea_pratica(p_pratica jsonb, p_fasi jsonb)
returns pratica
language plpgsql set search_path = public as $$
declare
  v_pratica pratica;
begin
  if not app_is_staff() then
    raise exception 'Solo Operatori e Amministratori creano le pratiche';
  end if;
  if jsonb_typeof(p_fasi) <> 'array' or jsonb_array_length(p_fasi) <> 7 then
    raise exception 'Una pratica deve nascere con 7 fasi';
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


-- ---------------------------------------------------------------------
-- 3. MODIFICA DI UN UTENTE (un'unica operazione)
-- ---------------------------------------------------------------------
-- Chiama le due funzioni esistenti nella stessa transazione: se la
-- seconda fallisce, anche il cambio di ruolo viene annullato. I controlli
-- (solo Admin, niente nomine di Admin, non su se stessi) sono quelli di
-- admin_aggiorna_utente (script 19) e admin_imposta_organizzazioni (10).
-- La prima organizzazione resta quella «principale» del profilo; per gli
-- Operatori le associazioni si azzerano.
create or replace function admin_aggiorna_utente_completo(
  p_utente uuid,
  p_ruolo ruolo_utente,
  p_organizzazioni uuid[]
)
returns void
language plpgsql set search_path = public as $$
declare
  v_org uuid[] := case when p_ruolo = 'cliente' then coalesce(p_organizzazioni, '{}') else '{}' end;
begin
  perform admin_aggiorna_utente(p_utente, p_ruolo, v_org[1]);
  perform admin_imposta_organizzazioni(p_utente, v_org);
end $$;
grant execute on function admin_aggiorna_utente_completo(uuid, ruolo_utente, uuid[]) to authenticated;


-- ---------------------------------------------------------------------
-- 4. CALCOLO DEI CREDITI: COERENZA DEL RISULTATO
-- ---------------------------------------------------------------------
-- 4a + 4c. Trigger prima di ogni modifica di un calcolo in bozza.
-- Il nome trg_calcolo_coerenza viene alfabeticamente prima di
-- trg_calcolo_immutabile (script 11/18), quindi questi controlli girano
-- prima dell'assegnazione del numero di registro.
create or replace function calcolo_coerenza()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_conf bigint;
  v_riuso bigint;
  v_attese_conf bigint;
  v_attese_riuso bigint;
begin
  -- I calcoli confermati li protegge calcolo_immutabile.
  if old.stato <> 'bozza' then
    return new;
  end if;

  -- 4a. Dati cambiati senza un nuovo risultato: il risultato non vale più.
  if (new.dati is distinct from old.dati
      or new.anno is distinct from old.anno
      or new.tipo is distinct from old.tipo
      or new.data_avvio is distinct from old.data_avvio)
     and new.risultato is not distinct from old.risultato then
    new.risultato := null;
    new.delta_i_kg := null;
    new.buffer_pct := null;
    new.crediti_lordi := null;
    new.crediti_netti := null;
    new.calcolato_il := null;
  end if;

  -- 4c. Conferma: il risultato deve riferirsi alla Banca Dati Utenze salvata.
  if new.stato = 'confermato' then
    if new.risultato is null then
      raise exception 'Esegui il calcolo prima di confermarlo';
    end if;
    if not (new.risultato ? 'righe') then
      raise exception 'Premi di nuovo «Calcola» prima di confermare: il risultato salvato è di una versione precedente del portale';
    end if;
    v_attese_conf := (new.risultato -> 'righe' ->> 'conferimenti')::bigint;
    v_attese_riuso := (new.risultato -> 'righe' ->> 'riuso')::bigint;
    select count(*) into v_conf from calcolo_conferimento where calcolo_id = new.id;
    select count(*) into v_riuso from calcolo_riuso where calcolo_id = new.id;
    if v_conf is distinct from v_attese_conf or v_riuso is distinct from v_attese_riuso then
      raise exception 'La Banca Dati Utenze salvata (% righe di conferimento, % di riuso) non corrisponde a quella usata nel calcolo (% e %): ricarica la pagina e premi di nuovo «Calcola»',
        v_conf, v_riuso, coalesce(v_attese_conf::text, '?'), coalesce(v_attese_riuso::text, '?');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_calcolo_coerenza on calcolo_crediti;
create trigger trg_calcolo_coerenza before update on calcolo_crediti
  for each row execute function calcolo_coerenza();

-- 4b. Banca Dati Utenze modificata: azzera il risultato dei calcoli in
-- bozza coinvolti. Trigger per istruzione (non per riga): un salvataggio
-- a blocchi aggiorna il calcolo una volta sola (la condizione «risultato
-- is not null» evita aggiornamenti e voci di audit ripetute).
create or replace function calcolo_bdu_modificata()
returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update calcolo_crediti c
       set risultato = null, delta_i_kg = null, buffer_pct = null,
           crediti_lordi = null, crediti_netti = null, calcolato_il = null
     where c.stato = 'bozza' and c.risultato is not null
       and c.id in (select distinct calcolo_id from vecchie);
  else
    update calcolo_crediti c
       set risultato = null, delta_i_kg = null, buffer_pct = null,
           crediti_lordi = null, crediti_netti = null, calcolato_il = null
     where c.stato = 'bozza' and c.risultato is not null
       and c.id in (select distinct calcolo_id from nuove);
  end if;
  return null;
end $$;

drop trigger if exists trg_conferimento_bdu_ins on calcolo_conferimento;
create trigger trg_conferimento_bdu_ins after insert on calcolo_conferimento
  referencing new table as nuove for each statement execute function calcolo_bdu_modificata();
drop trigger if exists trg_conferimento_bdu_upd on calcolo_conferimento;
create trigger trg_conferimento_bdu_upd after update on calcolo_conferimento
  referencing new table as nuove for each statement execute function calcolo_bdu_modificata();
drop trigger if exists trg_conferimento_bdu_del on calcolo_conferimento;
create trigger trg_conferimento_bdu_del after delete on calcolo_conferimento
  referencing old table as vecchie for each statement execute function calcolo_bdu_modificata();

drop trigger if exists trg_riuso_bdu_ins on calcolo_riuso;
create trigger trg_riuso_bdu_ins after insert on calcolo_riuso
  referencing new table as nuove for each statement execute function calcolo_bdu_modificata();
drop trigger if exists trg_riuso_bdu_upd on calcolo_riuso;
create trigger trg_riuso_bdu_upd after update on calcolo_riuso
  referencing new table as nuove for each statement execute function calcolo_bdu_modificata();
drop trigger if exists trg_riuso_bdu_del on calcolo_riuso;
create trigger trg_riuso_bdu_del after delete on calcolo_riuso
  referencing old table as vecchie for each statement execute function calcolo_bdu_modificata();

-- 4d. Nuova versione di un calcolo (di solito confermato) in un'unica
-- operazione: copia testata e dati, poi conferimenti e riuso. Il
-- risultato non si copia: va ricalcolato. Restituisce la nuova bozza.
-- Security invoker: valgono le regole RLS del calcolo (solo Admin).
create or replace function admin_nuova_versione_calcolo(p_calcolo uuid)
returns calcolo_crediti
language plpgsql set search_path = public as $$
declare
  v_orig calcolo_crediti;
  v_nuovo calcolo_crediti;
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore gestisce il calcolo dei crediti';
  end if;
  select * into v_orig from calcolo_crediti where id = p_calcolo;
  if not found then
    raise exception 'Calcolo non trovato';
  end if;

  insert into calcolo_crediti (pratica_id, titolo, anno, tipo, data_avvio, dati, versione_di)
  values (v_orig.pratica_id, v_orig.titolo || ' (rev.)', v_orig.anno, v_orig.tipo,
          v_orig.data_avvio, v_orig.dati, v_orig.id)
  returning * into v_nuovo;

  insert into calcolo_conferimento (calcolo_id, utenza, macro, classe, tipologia, svuotamenti, volume,
                                    peso_strutture, volume_strutture, peso_cdr, volume_cdr, n_utenze)
  select v_nuovo.id, utenza, macro, classe, tipologia, svuotamenti, volume,
         peso_strutture, volume_strutture, peso_cdr, volume_cdr, n_utenze
  from calcolo_conferimento where calcolo_id = p_calcolo order by id;

  insert into calcolo_riuso (calcolo_id, utenza, macro, classe, bene, pezzi, peso, n_utenze)
  select v_nuovo.id, utenza, macro, classe, bene, pezzi, peso, n_utenze
  from calcolo_riuso where calcolo_id = p_calcolo order by id;

  return v_nuovo;
end $$;
grant execute on function admin_nuova_versione_calcolo(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 5. PASSWORD TEMPORANEA: NESSUN ACCESSO AI DATI FINCHÉ NON SI CAMBIA
-- ---------------------------------------------------------------------
-- Le tre funzioni su cui si reggono tutte le regole RLS (scripts 02, 06,
-- 10) ora escludono anche i profili con password_temporanea = true
-- (script 15). Il proprio profilo resta leggibile (regola
-- profilo_self_select: id = auth.uid()) e password_cambiata() funziona,
-- quindi l'utente può completare il cambio password; subito dopo il
-- database gli riconosce ruolo e organizzazioni.

-- Ruolo dell'utente corrente; nessun ruolo se il profilo è disattivato o
-- se deve ancora cambiare la password temporanea.
create or replace function app_ruolo()
returns ruolo_utente
language sql stable security definer set search_path = public as $$
  select ruolo from profilo where id = auth.uid() and attivo and not password_temporanea;
$$;

-- Organizzazione principale; stesse condizioni di app_ruolo().
create or replace function app_organizzazione()
returns uuid
language sql stable security definer set search_path = public as $$
  select organizzazione_id from profilo where id = auth.uid() and attivo and not password_temporanea;
$$;

-- Organizzazioni associate (multi-organizzazione, script 06/10); stesse
-- condizioni di app_ruolo().
create or replace function app_org_mia(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null
    and exists (select 1 from profilo where id = auth.uid() and attivo and not password_temporanea)
    and (
      p_org = app_organizzazione()
      or exists (
        select 1 from utente_organizzazione uo
        where uo.utente_id = auth.uid()
          and uo.organizzazione_id = p_org
      )
    );
$$;
