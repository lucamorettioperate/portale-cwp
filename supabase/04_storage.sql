-- =====================================================================
--  STORAGE — archivio dei documenti delle pratiche.
--  Crea un bucket privato "documenti" e le regole di accesso.
--  Eseguire DOPO 02_sicurezza.sql, nel SQL Editor di Supabase.
--
--  Principi:
--  - bucket PRIVATO: i file non sono accessibili pubblicamente via URL.
--  - percorso file: documenti/<pratica_id>/<nome-file>
--  - lo staff (operatore/admin) accede a tutto; il cliente ai file delle
--    proprie pratiche. L'accesso effettivo passa comunque per la tabella
--    "documento" e le sue policy (visibilità).
-- =====================================================================

-- Crea il bucket privato (idempotente).
insert into storage.buckets (id, name, public)
values ('documenti', 'documenti', false)
on conflict (id) do nothing;

-- Pulisce eventuali policy omonime già presenti.
drop policy if exists documenti_select on storage.objects;
drop policy if exists documenti_insert on storage.objects;
drop policy if exists documenti_update on storage.objects;
drop policy if exists documenti_delete on storage.objects;

-- La prima cartella del percorso è l'id della pratica.
-- Helper inline: la pratica è accessibile all'utente corrente?
-- (riusa pratica_mia definita in 02_sicurezza.sql)

-- Lettura: staff tutto; cliente solo i file delle proprie pratiche.
create policy documenti_select on storage.objects for select
  using (
    bucket_id = 'documenti'
    and (
      app_is_staff()
      or pratica_mia( (storage.foldername(name))[1]::uuid )
    )
  );

-- Caricamento: staff, o cliente sulle proprie pratiche.
create policy documenti_insert on storage.objects for insert
  with check (
    bucket_id = 'documenti'
    and (
      app_is_staff()
      or pratica_mia( (storage.foldername(name))[1]::uuid )
    )
  );

-- Aggiornamento/sovrascrittura: solo staff (i clienti non sovrascrivono mai).
create policy documenti_update on storage.objects for update
  using ( bucket_id = 'documenti' and app_is_staff() );

-- Cancellazione: solo staff (e comunque il modello non prevede cancellazioni).
create policy documenti_delete on storage.objects for delete
  using ( bucket_id = 'documenti' and app_is_staff() );
