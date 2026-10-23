-- =====================================================================
--  43 — VALORE DEI PROGETTI: LISTINO CASO 1 / CASO 2
--
--  Scopo (richiesta di Luca Moretti del 23/10/2026): la Dashboard mostra
--  anche il valore complessivo dei progetti, cioè quanto paga il cliente
--  (il Comune o il gestore) secondo le tabelle dei costi per il Soggetto
--  promotore: Caso 1 (progetto volontario) oppure Caso 2 (progetto
--  obbligatorio da bando di gara), due listini diversi
--  (src/lib/crediti/simulatore.js, costiPerCaso). Quando si apre una
--  pratica, come già nel simulatore, si sceglie il caso.
--
--   1. pratica.caso_listino: 'caso1' | 'caso2' | null (da indicare), solo
--      per i Progetti (i Rapporti rientrano nel listino del Progetto).
--   2. staff_crea_pratica e staff_aggiorna_dati_pratica (script 23) ora
--      salvano anche il caso (audit della pratica come prima).
--   3. scenario_simulazione.costo_cliente_totale: quanto paga il cliente
--      nel periodo simulato con il Caso 1 o 2 (salvato dal simulatore;
--      null con gli altri listini).
--   4. cruscotto_valore_progetti(): per la Dashboard e «Le mie pratiche»
--      (staff: tutto; Comuni: solo i propri, come lo script 42):
--      simulazione (ultimo scenario per Comune) e l'elenco dei Progetti non
--      annullati né ritirati con caso, popolazione e periodo. Il valore
--      dei Progetti lo calcola il portale con le stesse tabelle del
--      simulatore (una sola fonte dei listini).
--
--  Nessun dato esistente cambia: i Progetti già aperti restano con il caso
--  «da indicare» finché lo staff non lo sceglie nei dati della pratica.
--  Eseguire DOPO lo script 42, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni. Prove su banco isolato: t43.sql.
--  Registro sviluppo e deploy: capitolo «Database», script 43.
-- =====================================================================

-- 1. Caso del listino sul Progetto.
alter table pratica add column if not exists caso_listino text;
alter table pratica drop constraint if exists chk_caso_listino;
alter table pratica add constraint chk_caso_listino
  check (caso_listino is null or caso_listino in ('caso1', 'caso2'));

-- 2. Creazione (pratica e fasi insieme) con il caso del listino.
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

  if coalesce(nullif(trim(p_pratica ->> 'caso_listino'), ''), 'caso1') not in ('caso1', 'caso2') then
    raise exception 'Listino non valido: scegli Caso 1 (progetto volontario) o Caso 2 (obbligatorio da bando di gara)';
  end if;
  insert into pratica (tipo, organizzazione_id, codice, titolo, stato, progetto_padre_id, anno_monitoraggio,
                       periodo_riferimento, codici_istat, copromotori, popolazione, crediti_previsti, caso_listino)
  select r.tipo, r.organizzazione_id, nullif(trim(r.codice), ''), r.titolo,
         coalesce(r.stato, 'attiva'), r.progetto_padre_id, r.anno_monitoraggio,
         coalesce(r.periodo_riferimento, '10 anni'), coalesce(r.codici_istat, '{}'),
         coalesce(r.copromotori, '{}'), r.popolazione, r.crediti_previsti,
         case when r.tipo = 'progetto' then nullif(trim(r.caso_listino), '') end
  from jsonb_populate_record(null::pratica, p_pratica) r
  returning * into v_pratica;

  insert into fase (pratica_id, numero, nome, responsabile, stato)
  select v_pratica.id, f.numero, f.nome, f.responsabile, coalesce(f.stato, 'non_iniziata')
  from jsonb_populate_recordset(null::fase, p_fasi) f;

  return v_pratica;
end $$;

-- Modifica dei dati del Progetto o del Rapporto, ora anche il caso del
-- listino (solo Progetti; vuoto = da indicare).
create or replace function staff_aggiorna_dati_pratica(p_pratica uuid, p_dati jsonb, p_motivazione text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare p pratica; v_periodo text; v_max int;
begin
  perform cwp_richiedi_staff();
  select * into p from pratica where id = p_pratica;
  if p.id is null then raise exception 'Pratica non trovata'; end if;
  if p_motivazione is not null and length(trim(p_motivazione)) > 0 then
    perform set_config('cwp.motivazione', trim(p_motivazione), true);
  end if;
  if coalesce(nullif(trim(p_dati ->> 'caso_listino'), ''), 'caso1') not in ('caso1', 'caso2') then
    raise exception 'Listino non valido: scegli Caso 1 (progetto volontario) o Caso 2 (obbligatorio da bando di gara)';
  end if;
  v_periodo := coalesce(p_dati ->> 'periodo_riferimento', p.periodo_riferimento);
  if p.tipo = 'progetto' and v_periodo <> p.periodo_riferimento then
    select coalesce(max(anno_monitoraggio), 0) into v_max from pratica
     where progetto_padre_id = p.id and tipo = 'rapporto';
    if v_max > cwp_massimo_rapporti(v_periodo) then
      raise exception 'Il Progetto ha già % Rapporti: il periodo «%» ne ammette %', v_max, v_periodo, cwp_massimo_rapporti(v_periodo);
    end if;
  end if;
  update pratica set
    titolo = case when p_dati ? 'titolo' then nullif(trim(p_dati ->> 'titolo'), '') else titolo end,
    codici_istat = case when p_dati ? 'codici_istat' and p.tipo = 'progetto'
                        then array(select jsonb_array_elements_text(p_dati -> 'codici_istat')) else codici_istat end,
    copromotori = case when p_dati ? 'copromotori' and p.tipo = 'progetto'
                       then array(select trim(x) from jsonb_array_elements_text(p_dati -> 'copromotori') x where trim(x) <> '')
                       else copromotori end,
    periodo_riferimento = case when p.tipo = 'progetto' then v_periodo else periodo_riferimento end,
    popolazione = case when p_dati ? 'popolazione' then nullif(p_dati ->> 'popolazione', '')::int else popolazione end,
    crediti_previsti = case when p_dati ? 'crediti_previsti' then nullif(p_dati ->> 'crediti_previsti', '')::int else crediti_previsti end,
    caso_listino = case when p_dati ? 'caso_listino' and p.tipo = 'progetto'
                        then nullif(trim(p_dati ->> 'caso_listino'), '') else caso_listino end,
    aggiornato_il = now()
  where id = p_pratica;
  -- Il periodo vale anche per i Rapporti del Progetto.
  if p.tipo = 'progetto' then
    update pratica set periodo_riferimento = v_periodo
     where progetto_padre_id = p.id and periodo_riferimento <> v_periodo;
  end if;
end $$;
grant execute on function staff_aggiorna_dati_pratica(uuid, jsonb, text) to authenticated;

-- 3. Quanto paga il cliente nello scenario del simulatore.
alter table scenario_simulazione add column if not exists costo_cliente_totale numeric;

-- 4. Dati per il valore dei progetti.
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
revoke execute on function cruscotto_valore_progetti() from public, anon;
grant execute on function cruscotto_valore_progetti() to authenticated;

-- Verifica rapida.
select (select count(*) from information_schema.columns where table_name = 'pratica' and column_name = 'caso_listino') as colonna_caso,
       (select count(*) from information_schema.columns where table_name = 'scenario_simulazione' and column_name = 'costo_cliente_totale') as colonna_costo,
       (select count(*) from pratica where tipo = 'progetto' and caso_listino is null) as progetti_da_indicare;
