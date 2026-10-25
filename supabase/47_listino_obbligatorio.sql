-- =====================================================================
--  47 — LISTINO OBBLIGATORIO PER I PROGETTI
--
--  Richiesta di Luca Moretti del 25/10/2026 (ore 12:07): «per i dati
--  esistenti imposta a tutti caso 1, poi rendi obbligatoria la selezione
--  del campo per i nuovi inserimenti».
--  1. I Progetti con il listino «da indicare» (nati prima dello script 43)
--     passano a Caso 1 (progetto volontario). La modifica va nell'audit con
--     la motivazione «indicato da Luca Moretti il 25/10/2026».
--  2. Da qui in poi il listino è obbligatorio per ogni Progetto, nuovo o
--     modificato: trigger con messaggio in italiano e vincolo nel database
--     (i Rapporti di Monitoraggio non hanno listino).
--
--  Rieseguibile. Prova: t47.sql sul banco locale.
--  Registro sviluppo e deploy: cronologia del 25/10/2026.
-- =====================================================================

-- 1. Progetti esistenti senza listino → Caso 1, con motivazione nell'audit.
do $$
declare v int;
begin
  perform set_config('cwp.motivazione', 'Listino Caso 1 per i Progetti esistenti, indicato da Luca Moretti il 25/10/2026', true);
  update pratica set caso_listino = 'caso1' where tipo = 'progetto' and caso_listino is null;
  get diagnostics v = row_count;
  raise notice 'Progetti passati a Caso 1: %', v;
end $$;

-- 2. Messaggio chiaro se manca il listino (prima del vincolo).
create or replace function pratica_listino_obbligatorio()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.tipo = 'progetto' and new.caso_listino is null then
    raise exception 'Scegli il listino: Caso 1 (progetto volontario) o Caso 2 (obbligatorio da bando di gara)';
  end if;
  return new;
end $$;
drop trigger if exists trg_pratica_listino on pratica;
create trigger trg_pratica_listino
  before insert or update of caso_listino, tipo on pratica
  for each row execute function pratica_listino_obbligatorio();

alter table pratica drop constraint if exists chk_progetto_listino;
alter table pratica add constraint chk_progetto_listino
  check (tipo <> 'progetto' or caso_listino is not null);

-- Verifica (solo lettura).
select (select count(*) from pratica where tipo = 'progetto' and caso_listino is null) as progetti_senza_listino,
       (select count(*) from pratica where tipo = 'progetto' and caso_listino = 'caso1') as progetti_caso1,
       (select count(*) from pratica where tipo = 'progetto' and caso_listino = 'caso2') as progetti_caso2;
