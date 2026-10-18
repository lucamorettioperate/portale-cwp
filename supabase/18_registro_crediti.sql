-- =====================================================================
--  REGISTRO DEI CREDITI (backlog 7 — 18/10/2026)
--  Eseguire DOPO 17_pratiche.sql. Lo script è rieseguibile.
--
--  Ogni calcolo EX POST confermato riceve un numero di registro
--  progressivo e immutabile, nel formato CWP-REG-AAAA-NNNN (AAAA = anno
--  della conferma). Gli ex ante sono stime: non entrano nel registro.
--  Il registro (pagina Crediti CWP → Registro) elenca i calcoli registrati;
--  un calcolo corretto con una «nuova versione» confermata resta nel
--  registro come SOSTITUITO e il suo numero non si riusa.
--  Le regole di emissione, trasferimento e annullamento dei crediti
--  previste dallo Standard CWP / Guida al Programma si aggiungeranno quando
--  i documenti saranno disponibili (registro sviluppo e deploy, backlog 7).
-- =====================================================================

alter table calcolo_crediti add column if not exists numero_registro text unique;

-- Contatore per anno (niente buchi nella numerazione, anche con più
-- conferme contemporanee: la riga è bloccata durante l'aggiornamento).
create table if not exists contatore_registro (
  anno   int primary key,
  ultimo int not null default 0
);
alter table contatore_registro enable row level security;
-- Nessuna policy: lo usa solo la funzione qui sotto.

create or replace function cwp_numero_registro(p_quando timestamptz)
returns text
language plpgsql security definer set search_path = public as $$
declare v_anno int := extract(year from p_quando at time zone 'Europe/Rome'); v_n int;
begin
  insert into contatore_registro (anno, ultimo) values (v_anno, 1)
  on conflict (anno) do update set ultimo = contatore_registro.ultimo + 1
  returning ultimo into v_n;
  return format('CWP-REG-%s-%s', v_anno, lpad(v_n::text, 4, '0'));
end $$;

-- Stessa regola di immutabilità dello script 11, con in più il numero di
-- registro assegnato alla conferma degli ex post.
create or replace function calcolo_immutabile()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_stato text; v_id uuid;
begin
  if tg_table_name = 'calcolo_crediti' then
    if tg_op = 'DELETE' then
      if old.stato = 'confermato' then
        raise exception 'Un calcolo confermato non si cancella';
      end if;
      return old;
    end if;
    if old.stato = 'confermato' then
      raise exception 'Un calcolo confermato non si modifica: creane una nuova versione';
    end if;
    if new.numero_registro is distinct from old.numero_registro and new.stato <> 'confermato' then
      raise exception 'Il numero di registro lo assegna il portale alla conferma';
    end if;
    if new.stato = 'confermato' then
      if new.risultato is null then
        raise exception 'Esegui il calcolo prima di confermarlo';
      end if;
      new.confermato_da := auth.uid();
      new.confermato_il := now();
      new.numero_registro := case when new.tipo = 'ex_post' then cwp_numero_registro(now()) end;
    end if;
    new.aggiornato_il := now();
    return new;
  end if;
  v_id := case when tg_op = 'DELETE' then old.calcolo_id else new.calcolo_id end;
  select stato into v_stato from calcolo_crediti where id = v_id;
  if v_stato = 'confermato' then
    raise exception 'I dati di un calcolo confermato non si modificano';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Un nuovo calcolo non può nascere già con un numero di registro.
create or replace function calcolo_senza_numero()
returns trigger
language plpgsql as $$
begin
  new.numero_registro := null;
  return new;
end $$;
drop trigger if exists trg_calcolo_senza_numero on calcolo_crediti;
create trigger trg_calcolo_senza_numero before insert on calcolo_crediti
  for each row execute function calcolo_senza_numero();

-- Calcoli ex post già confermati: numero assegnato in ordine di conferma
-- (il trigger di immutabilità si sospende solo per questa operazione).
do $$
declare c record;
begin
  alter table calcolo_crediti disable trigger trg_calcolo_immutabile;
  for c in select id, confermato_il from calcolo_crediti
            where stato = 'confermato' and tipo = 'ex_post' and numero_registro is null
            order by confermato_il loop
    update calcolo_crediti set numero_registro = cwp_numero_registro(coalesce(c.confermato_il, now())) where id = c.id;
  end loop;
  alter table calcolo_crediti enable trigger trg_calcolo_immutabile;
end $$;

-- Registro: calcoli registrati con lo stato (valido o sostituito da una
-- nuova versione confermata). Solo Amministratori.
create or replace function admin_registro_crediti()
returns table (
  numero_registro text, calcolo_id uuid, pratica_codice text, ente text, anno int,
  crediti_lordi numeric, buffer_pct numeric, crediti_netti numeric,
  confermato_il timestamptz, confermato_da text, sostituito_da text, valido boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then raise exception 'Riservato agli amministratori'; end if;
  return query
    select c.numero_registro, c.id, p.codice, o.denominazione, c.anno,
           c.crediti_lordi, c.buffer_pct, c.crediti_netti, c.confermato_il,
           coalesce(nullif(pr.nome_completo, ''), u.email)::text,
           s.numero_registro, s.id is null
      from calcolo_crediti c
      join pratica p on p.id = c.pratica_id
      join organizzazione o on o.id = p.organizzazione_id
      left join auth.users u on u.id = c.confermato_da
      left join profilo pr on pr.id = c.confermato_da
      left join lateral (
        select n.id, n.numero_registro from calcolo_crediti n
         where n.versione_di = c.id and n.stato = 'confermato'
         order by n.confermato_il desc limit 1
      ) s on true
     where c.numero_registro is not null
     order by c.numero_registro;
end $$;
grant execute on function admin_registro_crediti() to authenticated;
