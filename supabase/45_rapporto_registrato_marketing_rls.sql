-- =====================================================================
--  45 — RAPPORTI SOLO PER PROGETTI REGISTRATI; MARKETING PIÙ VELOCE
--
--  Segnalazioni di Luca Moretti del 23/10/2026 (ore 15:24):
--  1. «è ancora possibile creare un Rapporto di Monitoraggio per una
--     pratica non ancora registrata (es. CWP-2026-003)»: un nuovo Rapporto
--     ora si accetta solo se il Progetto è registrato, cioè con la fase 6
--     «Seconda verifica documentale» completata (stesso criterio di
--     cwp_stato_programma e di data_registrazione, script 23). Il trigger
--     resta solo sull'inserimento: i Rapporti già creati non si toccano
--     (nessuna correzione automatica dei dati di collaudo).
--  2. «in Marketing l'elenco dei Comuni senza filtri non si carica e
--     mostra 0 Comuni»: la lettura di tutti i 7.904 Comuni superava il
--     tempo massimo perché la regola RLS calcolava app_is_admin() riga per
--     riga. Le regole delle tabelle mkt_* ora usano (select app_is_admin()),
--     calcolata una volta per lettura (sul banco con 8.000 Comuni: da 600 a
--     7 millisecondi). Chi può vedere cosa non cambia: solo Amministratori.
--
--  Rieseguibile. Prova: t45.sql sul banco locale.
--  Registro sviluppo e deploy: cronologia del 23/10/2026, capitolo 16.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rapporti di Monitoraggio solo per Progetti registrati
-- ---------------------------------------------------------------------
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
  -- Nuovo (23/10/2026): il Progetto deve essere registrato (fase 6 completata).
  if v_padre.data_registrazione is null and not exists (
    select 1 from fase where pratica_id = v_padre.id and numero = 6 and stato = 'completata') then
    raise exception 'Il Progetto % non è ancora registrato: il Rapporto di Monitoraggio si crea dopo la fase 6 «Seconda verifica documentale» completata',
      coalesce(v_padre.codice, '');
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

-- Il trigger (script 09) resta «before insert»: lo si ricrea uguale per
-- sicurezza, se mancasse.
drop trigger if exists trg_rapporto_coerente on pratica;
create trigger trg_rapporto_coerente
  before insert on pratica
  for each row execute function rapporto_coerente();

-- ---------------------------------------------------------------------
-- 2. Regole RLS del Marketing calcolate una volta per lettura
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['mkt_ente', 'mkt_referente', 'mkt_campagna', 'mkt_invio', 'mkt_disiscrizione', 'mkt_richiesta'] loop
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format('create policy %I on %I for all using ((select app_is_admin())) with check ((select app_is_admin()))', t || '_admin', t);
  end loop;
end $$;

-- Ordinamento dell'elenco per nome (pagine da 50).
create index if not exists idx_mkt_ente_tipo_denominazione on mkt_ente (tipo, denominazione, id);

-- Controllo finale (sola lettura): regole del Marketing e trigger presenti.
select (select count(*) from pg_policies where tablename like 'mkt_%' and qual like '%SELECT app_is_admin()%') as regole_marketing,
       (select count(*) from pg_trigger where tgname = 'trg_rapporto_coerente') as trigger_rapporto;
