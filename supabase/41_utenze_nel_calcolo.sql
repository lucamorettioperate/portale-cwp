-- =====================================================================
--  41 — UTENZE DEL CALCOLO NEL MOTORE: CONTROLLI DI CONFERMA
--
--  Scopo (richiesta di Luca Moretti del 23/10/2026): il motore di calcolo
--  usa le utenze del passo «5a. Utenze del calcolo» (tabella
--  calcolo_utenza, script 40) al posto dei conferimenti del tracciato
--  (passo 5b) quando il calcolo le ha. Ogni utenza va nella classe della
--  delibera indicata dalla sua CATEGORIA DI SIMULAZIONE e porta i kg
--  misurati di ogni frazione. Il calcolo gira nel browser
--  (src/lib/crediti/calcolo.js); il database garantisce che la conferma
--  sia coerente con le utenze salvate:
--
--   1. cwp_utenze_controllo(calcolo, dati): conta le utenze del calcolo,
--      quelle senza categoria di simulazione e quelle con una categoria
--      che non è tra le classi della delibera (dati.classiUd /
--      dati.classiUnd). Security definer perché la tabella delle utenze
--      non si legge direttamente (dati personali, script 40); restituisce
--      solo numeri.
--   2. calcolo_coerenza (script 20) ora confronta anche il NUMERO DI
--      UTENZE usato dal calcolo (risultato.righe.utenze) con quelle
--      salvate: se qualcuno cambia le utenze dopo «Calcola» la conferma è
--      rifiutata. I risultati salvati prima di oggi non hanno
--      righe.utenze: valgono 0, cioè «nessuna utenza», come prima.
--   3. calcolo_prerequisiti_conferma (script 35): per confermare servono
--      le utenze del passo 5a OPPURE i conferimenti del tracciato; con le
--      utenze, nessuna può essere senza categoria di simulazione o con una
--      categoria assente dalla delibera (il motore le lascia fuori dal
--      calcolo e un calcolo confermato deve comprendere tutte le utenze
--      dell'anno).
--
--  Nessun dato esistente cambia: i calcoli confermati restano com'erano
--  (calcolo_immutabile) e i calcoli senza utenze funzionano come prima.
--
--  Eseguire DOPO lo script 40, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Prove su banco isolato: t41.sql (vedi Registro issue e test).
--  Registro sviluppo e deploy: capitolo «Database», script 41;
--  capitolo 15 «Calcolo crediti».
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Conteggi delle utenze di un calcolo rispetto alla delibera.
-- ---------------------------------------------------------------------
-- p_dati: il JSON `dati` del calcolo (anche quello nuovo, non ancora
-- salvato, che arriva dal trigger). Le classi si confrontano come testo
-- senza spazi ai lati (come il portale).
create or replace function cwp_utenze_controllo(p_calcolo uuid, p_dati jsonb)
returns table (utenze bigint, senza_categoria bigint, categoria_ignota bigint)
language sql stable security definer set search_path = public as $$
  with classi as (
    select 'UD'::text as tipo, trim(c ->> 'classe') as classe
      from jsonb_array_elements(case when jsonb_typeof(p_dati -> 'classiUd') = 'array' then p_dati -> 'classiUd' else '[]'::jsonb end) c
    union
    select 'UnD', trim(c ->> 'classe')
      from jsonb_array_elements(case when jsonb_typeof(p_dati -> 'classiUnd') = 'array' then p_dati -> 'classiUnd' else '[]'::jsonb end) c
  )
  select count(*),
         count(*) filter (where coalesce(trim(u.categoria_simulazione), '') = ''),
         count(*) filter (where coalesce(trim(u.categoria_simulazione), '') <> ''
                            and not exists (select 1 from classi k where k.tipo = u.tipo and k.classe = trim(u.categoria_simulazione)))
    from calcolo_utenza u
   where u.calcolo_id = p_calcolo;
$$;
revoke execute on function cwp_utenze_controllo(uuid, jsonb) from public, anon;
grant execute on function cwp_utenze_controllo(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Coerenza del risultato (sostituisce la versione dello script 20).
-- ---------------------------------------------------------------------
create or replace function calcolo_coerenza()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_conf bigint;
  v_riuso bigint;
  v_utenze bigint;
  v_attese_conf bigint;
  v_attese_riuso bigint;
  v_attese_utenze bigint;
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

  -- 4c. Conferma: il risultato deve riferirsi alla Banca Dati Utenze salvata
  -- (conferimenti e riuso del tracciato e, dal 23/10/2026, utenze del passo 5a).
  if new.stato = 'confermato' then
    if new.risultato is null then
      raise exception 'Esegui il calcolo prima di confermarlo';
    end if;
    if not (new.risultato ? 'righe') then
      raise exception 'Premi di nuovo «Calcola» prima di confermare: il risultato salvato è di una versione precedente del portale';
    end if;
    v_attese_conf := (new.risultato -> 'righe' ->> 'conferimenti')::bigint;
    v_attese_riuso := (new.risultato -> 'righe' ->> 'riuso')::bigint;
    -- Risultati di prima del 23/10/2026: nessuna utenza.
    v_attese_utenze := coalesce((new.risultato -> 'righe' ->> 'utenze')::bigint, 0);
    select count(*) into v_conf from calcolo_conferimento where calcolo_id = new.id;
    select count(*) into v_riuso from calcolo_riuso where calcolo_id = new.id;
    select utenze into v_utenze from cwp_utenze_controllo(new.id, new.dati);
    if v_conf is distinct from v_attese_conf or v_riuso is distinct from v_attese_riuso then
      raise exception 'La Banca Dati Utenze salvata (% righe di conferimento, % di riuso) non corrisponde a quella usata nel calcolo (% e %): ricarica la pagina e premi di nuovo «Calcola»',
        v_conf, v_riuso, coalesce(v_attese_conf::text, '?'), coalesce(v_attese_riuso::text, '?');
    end if;
    if v_utenze is distinct from v_attese_utenze then
      raise exception 'Le utenze salvate del calcolo (%) non corrispondono a quelle usate nel calcolo (%): ricarica la pagina e premi di nuovo «Calcola»',
        v_utenze, v_attese_utenze;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_calcolo_coerenza on calcolo_crediti;
create trigger trg_calcolo_coerenza before update on calcolo_crediti
  for each row execute function calcolo_coerenza();

-- ---------------------------------------------------------------------
-- 3. Prerequisiti della conferma (sostituisce la versione dello script 35).
-- ---------------------------------------------------------------------
create or replace function calcolo_prerequisiti_conferma()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_utenze bigint;
  v_senza bigint;
  v_ignota bigint;
begin
  if old.stato = 'bozza' and new.stato = 'confermato' then
    select utenze, senza_categoria, categoria_ignota into v_utenze, v_senza, v_ignota
      from cwp_utenze_controllo(new.id, new.dati);
    if coalesce(v_utenze, 0) = 0
       and not exists (select 1 from calcolo_conferimento where calcolo_id = new.id) then
      raise exception 'Non si può confermare un calcolo senza Banca Dati Utenze: carica le utenze del calcolo (passo 5a) o i conferimenti del tracciato (passo 5b) e premi «Calcola»';
    end if;
    if coalesce(v_senza, 0) > 0 or coalesce(v_ignota, 0) > 0 then
      raise exception 'Non si può confermare: % utenze senza categoria di simulazione e % con una categoria che non è tra le classi della delibera. Correggile nel passo 5a e premi «Calcola»',
        v_senza, v_ignota;
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
