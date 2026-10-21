-- =====================================================================
--  37 — NOTIZIE CO2: PALLINO VERDE DELLE NOTIZIE NUOVE
--
--  Scopo (richiesta di Luca Moretti del 21/10/2026): quando ci sono
--  notizie nuove nella sezione «Notizie CO2», nel menu compare un pallino
--  verde in alto a destra della voce; si spegne quando l'Amministratore
--  entra nella sezione.
--
--  Cosa crea:
--   - tabella notizie_visita: per ogni Amministratore, quando ha aperto la
--     sezione l'ultima volta (una riga per utente; vale su ogni computer);
--   - notizie_nuove(): quante notizie attinenti e non nascoste sono state
--     trovate dopo l'ultima visita di chi chiede (mai visitata: tutte);
--   - notizie_segna_viste(): segna la visita adesso.
--  Solo per gli Amministratori (app_is_admin): agli altri le funzioni
--  restituiscono 0 o non fanno nulla.
--
--  Eseguire DOPO lo script 36, nel SQL Editor di Supabase. Si può
--  rieseguire senza danni.
--  Registro sviluppo e deploy: capitolo «Database», script 37.
-- =====================================================================

create table if not exists notizie_visita (
  utente_id uuid primary key references auth.users(id) on delete cascade,
  visto_il  timestamptz not null default now()
);
alter table notizie_visita enable row level security;
drop policy if exists notizie_visita_propria on notizie_visita;
create policy notizie_visita_propria on notizie_visita for select using (utente_id = auth.uid());
revoke insert, update, delete, truncate on notizie_visita from anon, authenticated;

-- Numero di notizie nuove per chi chiede (0 per chi non è Amministratore).
create or replace function notizie_nuove()
returns int
language sql stable security definer set search_path = public as $$
  select case when not app_is_admin() then 0 else (
    select count(*)::int from notizia n
     where n.attinente and not n.nascosta
       and n.trovata_il > coalesce((select visto_il from notizie_visita where utente_id = auth.uid()), '-infinity'::timestamptz)
  ) end;
$$;
revoke execute on function notizie_nuove() from public, anon;
grant execute on function notizie_nuove() to authenticated;

-- Segna la visita della sezione adesso (solo Amministratori).
create or replace function notizie_segna_viste()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then return; end if;
  insert into notizie_visita (utente_id, visto_il) values (auth.uid(), now())
  on conflict (utente_id) do update set visto_il = excluded.visto_il;
end $$;
revoke execute on function notizie_segna_viste() from public, anon;
grant execute on function notizie_segna_viste() to authenticated;

-- Verifica (solo lettura).
select (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'notizie_visita') as tabella_creata;
