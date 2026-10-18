-- =====================================================================
--  DOCUMENTI UFFICIALI DEL PROGRAMMA SULLA PAGINA PUBBLICA (18/10/2026)
--  Eseguire DOPO 24_programma_pubblico_crediti_reclami.sql, dopo aver
--  caricato i file PDF nella radice dell'archivio «modelli» (dashboard
--  Supabase → Storage → modelli). Lo script è rieseguibile.
--  Registro sviluppo e deploy: capitolo «Database», cronologia del 18/10.
--
--  Registra come modelli pubblici (categoria «programma», generali) gli otto
--  documenti del Programma v1.2 del 04/09/2025 (Guida 2.3 e 3.7) e collega
--  il PDF della Metodologia alla metodologia approvata. I documenti
--  compaiono sulla pagina pubblica /programma e, come modelli generali,
--  in «I tuoi documenti» dei Comuni.
-- =====================================================================

insert into modello_documento (titolo, descrizione, fase_numero, tipo_pratica, storage_path, nome_file,
                               dimensione, tipo_mime, attivo, pubblico, categoria)
select d.titolo, d.descrizione, null, null, o.name, o.name,
       (o.metadata ->> 'size')::bigint, 'application/pdf', true, true, 'programma'
  from (values
    ('CWP_0_GUIDA_AL_PROGRAMMA_CARBON_WASTEPRINT.pdf', 'Guida al Programma Carbon WastePrint®', 'Versione 1.2 del 04/09/2025: attori, procedimenti, documenti'),
    ('CWP_1_DEFINIZIONI.pdf', 'Definizioni', 'Versione 1.2 del 04/09/2025'),
    ('CWP_2_NORMATIVA_DI_RIFERIMENTO.pdf', 'Normativa di riferimento', 'Versione 1.2 del 04/09/2025'),
    ('CWP_3_STANDARD_CARBON_WASTEPRINT.pdf', 'Standard Carbon WastePrint®', 'Versione 1.2 del 04/09/2025: requisiti per progetti, enti e registri'),
    ('CWP_4_METODOLOGIA_CARBON_WASTEPRINT.pdf', 'Metodologia Carbon WastePrint®', 'Versione 1.2 del 04/09/2025, UNI EN ISO 14064-2:2019'),
    ('CWP_5_POLITICA_RECLAMO.pdf', 'Politica di reclamo', 'Versione 1.2 del 04/09/2025'),
    ('CWP_6_SCHEMA_TARIFFARIO.pdf', 'Schema tariffario', 'Versione 1.2 del 04/09/2025: tariffe massime, IVA esclusa'),
    ('CWP_7_GESTIONE_DELLA_QUALITA_DEI_DATI.pdf', 'Gestione della qualità dei dati', 'Versione 1.2 del 04/09/2025')
  ) d(file, titolo, descrizione)
  join storage.objects o on o.bucket_id = 'modelli' and o.name = d.file
on conflict (storage_path) do nothing;

update metodologia m set modello_id = md.id, aggiornato_il = now()
  from modello_documento md
 where m.nome = 'Metodologia Carbon WastePrint®' and m.modello_id is null
   and md.storage_path = 'CWP_4_METODOLOGIA_CARBON_WASTEPRINT.pdf';
