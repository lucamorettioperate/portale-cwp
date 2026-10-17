-- =====================================================================
--  ASSOCIAZIONE UTENTE ↔ PIÙ ORGANIZZAZIONI
--  Un utente cliente può essere associato a più comuni/organizzazioni.
--  Eseguire DOPO 05_gestione_utenti.sql, nel SQL Editor di Supabase.
-- =====================================================================

-- Tabella di collegamento (molti-a-molti).
create table if not exists utente_organizzazione (
  utente_id        uuid not null references auth.users(id) on delete cascade,
  organizzazione_id uuid not null references organizzazione(id) on delete cascade,
  creato_il        timestamptz not null default now(),
  primary key (utente_id, organizzazione_id)
);

alter table utente_organizzazione enable row level security;

-- Ciascuno vede le proprie associazioni; lo staff tutte.
drop policy if exists uo_select on utente_organizzazione;
create policy uo_select on utente_organizzazione for select
  using (utente_id = auth.uid() or app_is_staff());

-- Solo lo staff gestisce le associazioni.
drop policy if exists uo_write on utente_organizzazione;
create policy uo_write on utente_organizzazione for all
  using (app_is_staff()) with check (app_is_staff());

-- Migra le associazioni esistenti (dal vecchio campo singolo) nella tabella.
insert into utente_organizzazione (utente_id, organizzazione_id)
select id, organizzazione_id from profilo
where organizzazione_id is not null
on conflict do nothing;

-- Helper: l'organizzazione indicata è una di quelle dell'utente corrente?
-- (tabella molti-a-molti, più il vecchio campo singolo per retrocompatibilità)
create or replace function app_org_mia(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null and (
    p_org = app_organizzazione()
    or exists (
      select 1 from utente_organizzazione uo
      where uo.utente_id = auth.uid()
        and uo.organizzazione_id = p_org
    )
  );
$$;

-- Aggiorna "pratica_mia": l'utente vede le pratiche di tutte le
-- organizzazioni a cui è associato.
create or replace function pratica_mia(p_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pratica pr
    where pr.id = p_id
      and (app_is_staff() or app_org_mia(pr.organizzazione_id))
  );
$$;

-- Aggiorna le regole di visibilità che usavano solo il campo singolo:
-- elenco pratiche e anagrafica organizzazioni del cliente.
drop policy if exists pratica_select on pratica;
create policy pratica_select on pratica for select
  using (app_is_staff() or app_org_mia(organizzazione_id));

drop policy if exists org_select on organizzazione;
create policy org_select on organizzazione for select
  using (app_is_staff() or app_org_mia(id));

-- Funzione per impostare le organizzazioni di un utente (solo admin).
create or replace function admin_imposta_organizzazioni(
  p_utente uuid,
  p_organizzazioni uuid[]
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if app_ruolo() <> 'admin' then
    raise exception 'Solo un amministratore può modificare le associazioni';
  end if;
  delete from utente_organizzazione where utente_id = p_utente;
  if p_organizzazioni is not null then
    insert into utente_organizzazione (utente_id, organizzazione_id)
    select p_utente, unnest(p_organizzazioni)
    on conflict do nothing;
  end if;
  -- aggiorna anche il campo singolo (prima org) per compatibilità
  update profilo
    set organizzazione_id = (p_organizzazioni)[1]
  where id = p_utente;
end $$;

grant execute on function admin_imposta_organizzazioni(uuid, uuid[]) to authenticated;

-- Aggiorna admin_elenco_utenti per includere l'elenco organizzazioni.
-- (drop necessario perché cambia il tipo di ritorno)
drop function if exists admin_elenco_utenti();
create or replace function admin_elenco_utenti()
returns table (
  id uuid, email text, ruolo ruolo_utente, nome_completo text,
  organizzazione_id uuid, organizzazione text,
  organizzazioni_ids uuid[], organizzazioni_nomi text[],
  attivo boolean, creato_il timestamptz
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not app_is_staff() then
    raise exception 'Accesso non consentito';
  end if;
  return query
    select p.id, u.email::text, p.ruolo, p.nome_completo,
           p.organizzazione_id, o.denominazione,
           coalesce(array_agg(uo.organizzazione_id) filter (where uo.organizzazione_id is not null), '{}') as organizzazioni_ids,
           coalesce(array_agg(og.denominazione) filter (where og.denominazione is not null), '{}') as organizzazioni_nomi,
           p.attivo, p.creato_il
    from profilo p
    join auth.users u on u.id = p.id
    left join organizzazione o on o.id = p.organizzazione_id
    left join utente_organizzazione uo on uo.utente_id = p.id
    left join organizzazione og on og.id = uo.organizzazione_id
    group by p.id, u.email, p.ruolo, p.nome_completo, p.organizzazione_id, o.denominazione, p.attivo, p.creato_il
    order by p.creato_il desc;
end $$;

grant execute on function admin_elenco_utenti() to authenticated;
