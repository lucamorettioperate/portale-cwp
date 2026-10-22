-- =====================================================================
--  40 — UTENZE DEL CALCOLO DEI CREDITI (UNA RIGA PER UTENZA)
--
--  Scopo (richiesta di Luca Moretti del 22/10/2026): il calcolo dei
--  crediti è per utenza. Ogni calcolo carica OBBLIGATORIAMENTE l'elenco
--  completo delle utenze dell'anno, domestiche e non domestiche (le utenze
--  cambiano di continuo: nessuna anagrafe riusata da un anno all'altro).
--
--  Per ogni utenza:
--   - codice utenza (unico nel calcolo), tipo UD (domestica) o UnD (non
--     domestica);
--   - nominativo: nome del capofamiglia (UD) o ragione sociale (UnD);
--   - indirizzo;
--   - n. componenti (solo UD, facoltativo) e mq (facoltativi);
--   - categoria tariffaria (solo UnD, obbligatoria: serve per i rifiuti
--     attesi con i coefficienti Kd della delibera);
--   - produzione totale in kg/anno;
--   - per ogni frazione: kg/anno e svuotamenti (facoltativi);
--     l'indifferenziato è obbligatorio.
--  Le frazioni sono in un campo JSON, una voce per tipologia, con i codici
--  di src/lib/crediti/parametri.js:
--    {"indifferenziato": {"kg": 210, "svuotamenti": 26}, "organico": {"kg": 180}}
--
--  DATI PERSONALI (scelta di Luca del 22/10/2026: salvati e visibili allo
--  staff). Per questo:
--   - nessuna lettura diretta della tabella: si legge solo con le funzioni
--     staff_elenco_utenze e admin_utenze_calcolo, che scrivono nell'audit
--     chi ha consultato (operazione «consultazione utenze»);
--   - scrittura (caricamento, cancellazione) solo dell'Amministratore,
--     come il resto del calcolo dei crediti;
--   - il Comune non vede questa tabella;
--   - il caricamento produce UNA voce di audit con il numero di utenze
--     (non una per riga);
--   - restano da fare DPIA e accordo con i Comuni (art. 28 GDPR).
--
--  Integrità come il resto del calcolo (script 11, 18, 20):
--   - un calcolo confermato non cambia più le sue utenze;
--   - caricare o cancellare utenze azzera il risultato della bozza;
--   - la nuova versione di un calcolo copia anche le utenze.
--
--  Eseguire DOPO lo script 39, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 40;
--  capitolo 15 «Calcolo crediti».
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipologie di rifiuto ammesse (le stesse di parametri.js).
-- ---------------------------------------------------------------------
create or replace function cwp_tipologie_rifiuto()
returns text[]
language sql immutable as $$
  select array['indifferenziato', 'organico', 'verde', 'carta', 'vetro', 'legno', 'plastica',
               'metallo', 'inerti', 'tessili', 'raee', 'ingombranti'];
$$;

-- Controlla il campo frazioni: oggetto JSON con sole tipologie ammesse,
-- indifferenziato presente, kg numero >= 0, svuotamenti intero >= 0 o assente.
-- Restituisce null se va bene, altrimenti il motivo.
create or replace function cwp_frazioni_errore(p jsonb)
returns text
language plpgsql immutable as $$
declare k text; v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'frazioni mancanti';
  end if;
  if not (p ? 'indifferenziato') then
    return 'manca l''indifferenziato (obbligatorio)';
  end if;
  for k, v in select * from jsonb_each(p) loop
    if not (k = any (cwp_tipologie_rifiuto())) then
      return 'tipologia sconosciuta: ' || k;
    end if;
    if jsonb_typeof(v) <> 'object' or jsonb_typeof(v -> 'kg') <> 'number' or (v ->> 'kg')::numeric < 0 then
      return 'kg non valido per ' || k;
    end if;
    if v ? 'svuotamenti' and jsonb_typeof(v -> 'svuotamenti') <> 'null' and (
         jsonb_typeof(v -> 'svuotamenti') <> 'number'
         or (v ->> 'svuotamenti')::numeric < 0
         or (v ->> 'svuotamenti')::numeric <> trunc((v ->> 'svuotamenti')::numeric)) then
      return 'svuotamenti non validi per ' || k;
    end if;
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tabella delle utenze di un calcolo.
-- ---------------------------------------------------------------------
create table if not exists calcolo_utenza (
  id                  bigint generated always as identity primary key,
  calcolo_id          uuid not null references calcolo_crediti(id) on delete cascade,
  codice              text not null check (length(trim(codice)) between 1 and 60),
  tipo                text not null check (tipo in ('UD', 'UnD')),
  nominativo          text not null check (length(trim(nominativo)) between 1 and 200),
  indirizzo           text not null check (length(trim(indirizzo)) between 1 and 300),
  componenti          int check (componenti between 1 and 30),
  mq                  numeric check (mq > 0 and mq < 1000000),
  categoria           text check (categoria is null or length(trim(categoria)) between 1 and 40),
  produzione_totale_kg numeric not null check (produzione_totale_kg >= 0),
  frazioni            jsonb not null,
  creato_il           timestamptz not null default now(),
  constraint utenza_codice_unico unique (calcolo_id, codice),
  constraint utenza_componenti_solo_ud check (tipo = 'UD' or componenti is null),
  constraint utenza_categoria_und check (tipo = 'UD' or categoria is not null),
  constraint utenza_frazioni_valide check (cwp_frazioni_errore(frazioni) is null)
);
create index if not exists idx_utenza_calcolo on calcolo_utenza (calcolo_id, tipo, codice);

alter table calcolo_utenza enable row level security;
-- Nessuna regola di lettura: si legge solo con le funzioni del punto 5.
-- Scrittura: solo l'Amministratore (inserimento a blocchi dal portale).
drop policy if exists utenza_inserimento on calcolo_utenza;
create policy utenza_inserimento on calcolo_utenza for insert with check (app_is_admin());
revoke all on calcolo_utenza from anon;
grant insert on calcolo_utenza to authenticated;

-- ---------------------------------------------------------------------
-- 3. Integrità con il calcolo.
-- ---------------------------------------------------------------------
-- Calcolo confermato: utenze immutabili (stessa funzione dello script 18).
drop trigger if exists trg_utenza_immutabile on calcolo_utenza;
create trigger trg_utenza_immutabile before insert or update or delete on calcolo_utenza
  for each row execute function calcolo_immutabile();

-- Utenze cambiate: il risultato della bozza non vale più (script 20).
drop trigger if exists trg_utenza_bdu_ins on calcolo_utenza;
create trigger trg_utenza_bdu_ins after insert on calcolo_utenza
  referencing new table as nuove for each statement execute function calcolo_bdu_modificata();
drop trigger if exists trg_utenza_bdu_upd on calcolo_utenza;
create trigger trg_utenza_bdu_upd after update on calcolo_utenza
  referencing new table as nuove for each statement execute function calcolo_bdu_modificata();
drop trigger if exists trg_utenza_bdu_del on calcolo_utenza;
create trigger trg_utenza_bdu_del after delete on calcolo_utenza
  referencing old table as vecchie for each statement execute function calcolo_bdu_modificata();

-- Audit del caricamento: una voce per blocco inserito, con il numero di
-- utenze (UD e UnD), senza nomi né indirizzi.
create or replace function utenze_audit_caricamento()
returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select n.calcolo_id, count(*) as totale,
                  count(*) filter (where n.tipo = 'UD') as ud,
                  count(*) filter (where n.tipo = 'UnD') as und
             from nuove n group by n.calcolo_id loop
    insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, oggetto_id, pratica_id, dettaglio)
    select auth.uid(), app_ruolo(), 'caricamento utenze', 'calcolo_crediti', r.calcolo_id, c.pratica_id,
           jsonb_build_object('utenze', r.totale, 'domestiche', r.ud, 'non_domestiche', r.und)
      from calcolo_crediti c where c.id = r.calcolo_id;
  end loop;
  return null;
end $$;
drop trigger if exists trg_utenza_audit on calcolo_utenza;
create trigger trg_utenza_audit after insert on calcolo_utenza
  referencing new table as nuove for each statement execute function utenze_audit_caricamento();

-- ---------------------------------------------------------------------
-- 4. Scrittura: svuotare l'elenco prima di un nuovo caricamento.
-- ---------------------------------------------------------------------
-- Ogni anno l'elenco si ricarica completo: prima si toglie quello
-- precedente della bozza (motivazione facoltativa, nell'audit).
create or replace function admin_svuota_utenze(p_calcolo uuid, p_motivazione text default null)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_pratica uuid; v_stato text;
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore gestisce il calcolo dei crediti';
  end if;
  select pratica_id, stato into v_pratica, v_stato from calcolo_crediti where id = p_calcolo;
  if v_pratica is null then raise exception 'Calcolo non trovato'; end if;
  if v_stato = 'confermato' then raise exception 'I dati di un calcolo confermato non si modificano'; end if;
  delete from calcolo_utenza where calcolo_id = p_calcolo;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, oggetto_id, pratica_id, motivazione, dettaglio)
    values (auth.uid(), app_ruolo(), 'cancellazione utenze', 'calcolo_crediti', p_calcolo, v_pratica,
            nullif(trim(coalesce(p_motivazione, '')), ''), jsonb_build_object('utenze', v_n));
  end if;
  return v_n;
end $$;
revoke execute on function admin_svuota_utenze(uuid, text) from public, anon;
grant execute on function admin_svuota_utenze(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Lettura, sempre registrata nell'audit.
-- ---------------------------------------------------------------------
-- Elenco a pagine per la consultazione (Operatori e Amministratori):
-- ricerca su codice, nominativo e indirizzo; tipo 'UD', 'UnD' o null.
-- Una voce di audit per la prima pagina di ogni ricerca.
create or replace function staff_elenco_utenze(p_calcolo uuid, p_cerca text default null, p_tipo text default null,
                                               p_da int default 0, p_quanti int default 100)
returns table (id bigint, codice text, tipo text, nominativo text, indirizzo text, componenti int, mq numeric,
               categoria text, produzione_totale_kg numeric, frazioni jsonb, totale bigint)
language plpgsql security definer set search_path = public as $$
declare v_pratica uuid; v_cerca text := nullif(trim(coalesce(p_cerca, '')), '');
begin
  perform cwp_richiedi_staff();
  select pratica_id into v_pratica from calcolo_crediti where calcolo_crediti.id = p_calcolo;
  if v_pratica is null then raise exception 'Calcolo non trovato'; end if;
  if coalesce(p_da, 0) = 0 then
    insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, oggetto_id, pratica_id, dettaglio)
    values (auth.uid(), app_ruolo(), 'consultazione utenze', 'calcolo_crediti', p_calcolo, v_pratica,
            jsonb_strip_nulls(jsonb_build_object('ricerca', v_cerca, 'tipo', p_tipo)));
  end if;
  return query
  select u.id, u.codice, u.tipo, u.nominativo, u.indirizzo, u.componenti, u.mq, u.categoria,
         u.produzione_totale_kg, u.frazioni, count(*) over ()
    from calcolo_utenza u
   where u.calcolo_id = p_calcolo
     and (p_tipo is null or u.tipo = p_tipo)
     and (v_cerca is null or u.codice ilike '%' || v_cerca || '%' or u.nominativo ilike '%' || v_cerca || '%'
          or u.indirizzo ilike '%' || v_cerca || '%')
   order by u.tipo, u.codice
   offset greatest(coalesce(p_da, 0), 0) limit least(greatest(coalesce(p_quanti, 100), 1), 1000);
end $$;
revoke execute on function staff_elenco_utenze(uuid, text, text, int, int) from public, anon;
grant execute on function staff_elenco_utenze(uuid, text, text, int, int) to authenticated;

-- Lettura per il calcolo (solo Amministratore): SENZA nominativo e
-- indirizzo, che al motore non servono. A blocchi di 5.000 per gli
-- elenchi grandi. Nessun audit: non contiene dati personali.
create or replace function admin_utenze_calcolo(p_calcolo uuid, p_da int default 0, p_quanti int default 5000)
returns table (id bigint, codice text, tipo text, componenti int, mq numeric, categoria text,
               produzione_totale_kg numeric, frazioni jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore gestisce il calcolo dei crediti';
  end if;
  return query
  select u.id, u.codice, u.tipo, u.componenti, u.mq, u.categoria, u.produzione_totale_kg, u.frazioni
    from calcolo_utenza u where u.calcolo_id = p_calcolo
   order by u.id
   offset greatest(coalesce(p_da, 0), 0) limit least(greatest(coalesce(p_quanti, 5000), 1), 5000);
end $$;
revoke execute on function admin_utenze_calcolo(uuid, int, int) from public, anon;
grant execute on function admin_utenze_calcolo(uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Nuova versione di un calcolo: copia anche le utenze (script 20, 4d).
-- ---------------------------------------------------------------------
-- Ora security definer: le utenze non hanno regole di lettura, quindi la
-- copia deve girare con i diritti del proprietario (il controllo
-- dell'Amministratore resta la prima istruzione).
create or replace function admin_nuova_versione_calcolo(p_calcolo uuid)
returns calcolo_crediti
language plpgsql security definer set search_path = public as $$
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

  -- Utenze (script 40).
  insert into calcolo_utenza (calcolo_id, codice, tipo, nominativo, indirizzo, componenti, mq, categoria,
                              produzione_totale_kg, frazioni)
  select v_nuovo.id, codice, tipo, nominativo, indirizzo, componenti, mq, categoria,
         produzione_totale_kg, frazioni
  from calcolo_utenza where calcolo_id = p_calcolo order by id;

  return v_nuovo;
end $$;
revoke execute on function admin_nuova_versione_calcolo(uuid) from public, anon;
grant execute on function admin_nuova_versione_calcolo(uuid) to authenticated;

-- Verifica (solo lettura).
select count(*) as utenze_presenti from calcolo_utenza;
