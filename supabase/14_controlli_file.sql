-- =====================================================================
--  CONTROLLI SUI FILE CARICATI (requisiti §13 "Upload")
--  Eseguire DOPO 13_durata_fasi.sql. Lo script è rieseguibile.
--
--  - limite di dimensione: 50 MB per file (massimo del piano Supabase);
--  - whitelist dei formati: PDF, PDF firmato (.p7m), Word, Excel,
--    OpenDocument, RTF, CSV, testo, immagini JPG/PNG;
--  - controllo MIME: il bucket accetta solo i tipi della whitelist e il
--    database verifica che estensione e tipo dichiarato coincidano.
--    Il contenuto reale del file (le prime "firme" di byte) è verificato
--    dal portale prima dell'invio;
--  - un documento può riferirsi solo a un file realmente presente
--    nell'archivio, nella cartella della propria pratica.
--  La scansione antivirus richiede un servizio esterno: vedi
--  docs/controlli-file.md.
-- =====================================================================

-- Formati ammessi: estensione → tipo MIME canonico.
create or replace function cwp_formati_ammessi()
returns table (estensione text, mime text)
language sql immutable as $$
  values
    ('pdf',  'application/pdf'),
    ('p7m',  'application/pkcs7-mime'),
    ('doc',  'application/msword'),
    ('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ('odt',  'application/vnd.oasis.opendocument.text'),
    ('rtf',  'application/rtf'),
    ('xls',  'application/vnd.ms-excel'),
    ('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ('ods',  'application/vnd.oasis.opendocument.spreadsheet'),
    ('csv',  'text/csv'),
    ('txt',  'text/plain'),
    ('jpg',  'image/jpeg'),
    ('jpeg', 'image/jpeg'),
    ('png',  'image/png')
$$;

create or replace function cwp_dimensione_massima()
returns bigint
language sql immutable as $$ select 52428800::bigint $$;  -- 50 MB

-- Il bucket rifiuta già in ingresso file troppo grandi o di tipo non ammesso.
update storage.buckets
   set file_size_limit = cwp_dimensione_massima(),
       allowed_mime_types = (select array_agg(distinct mime) from cwp_formati_ammessi())
 where id = 'documenti';

-- Dati del file conservati con il documento.
alter table documento add column if not exists dimensione bigint;
alter table documento add column if not exists tipo_mime text;

create or replace function documento_verifica_file()
returns trigger
language plpgsql security definer set search_path = public, storage as $$
declare
  v_meta jsonb;
  v_ext text;
  v_mime text;
  v_size bigint;
begin
  if new.storage_path is null then
    return new;
  end if;

  -- Il file deve stare nella cartella della pratica del documento.
  if split_part(new.storage_path, '/', 1) <> new.pratica_id::text then
    raise exception 'Il file non appartiene a questa pratica';
  end if;

  select o.metadata into v_meta
  from storage.objects o
  where o.bucket_id = 'documenti' and o.name = new.storage_path;
  if not found then
    raise exception 'File non trovato nell''archivio: caricamento non completato';
  end if;

  v_ext  := lower(substring(new.storage_path from '\.([A-Za-z0-9]+)$'));
  v_mime := lower(split_part(coalesce(v_meta ->> 'mimetype', ''), ';', 1));
  v_size := nullif(v_meta ->> 'size', '')::bigint;

  if v_ext is null or not exists (select 1 from cwp_formati_ammessi() f where f.estensione = v_ext) then
    raise exception 'Formato non ammesso (.%)', coalesce(v_ext, '?');
  end if;
  if not exists (select 1 from cwp_formati_ammessi() f where f.estensione = v_ext and f.mime = v_mime) then
    raise exception 'Il tipo del file (%) non corrisponde all''estensione .%', coalesce(nullif(v_mime, ''), 'sconosciuto'), v_ext;
  end if;
  if v_size is not null and v_size > cwp_dimensione_massima() then
    raise exception 'File troppo grande: il limite è 50 MB';
  end if;
  if v_size is not null and v_size = 0 then
    raise exception 'Il file è vuoto';
  end if;

  new.dimensione := v_size;
  new.tipo_mime := v_mime;
  return new;
end $$;

drop trigger if exists trg_documento_verifica_file on documento;
create trigger trg_documento_verifica_file
  before insert on documento
  for each row execute function documento_verifica_file();
