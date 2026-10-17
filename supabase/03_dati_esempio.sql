-- =====================================================================
--  DATI DI ESEMPIO per il collaudo del back-office.
--  Crea 3 organizzazioni, 3 progetti e le loro 7 fasi ciascuno.
--  Si possono cancellare in blocco con lo script in fondo (commentato).
--  Eseguire DOPO 01_schema.sql e 02_sicurezza.sql.
-- =====================================================================

-- Organizzazioni di esempio
insert into organizzazione (id, denominazione, tipo) values
  ('a0000000-0000-0000-0000-000000000001', 'Comune di Borgoval', 'Ente locale (T.U.E.L.)'),
  ('a0000000-0000-0000-0000-000000000002', 'Ambito Riviera Nord', 'Ente di Governo ATO'),
  ('a0000000-0000-0000-0000-000000000003', 'AmbienteServizi SpA', 'Soggetto gestore')
on conflict (id) do nothing;

-- Progetti di esempio
insert into pratica (id, codice, tipo, organizzazione_id, titolo, stato) values
  ('b0000000-0000-0000-0000-000000000001', 'CWP-2026-0001', 'progetto', 'a0000000-0000-0000-0000-000000000001', 'Certificazione gestione rifiuti urbani', 'attiva'),
  ('b0000000-0000-0000-0000-000000000002', 'CWP-2026-0002', 'progetto', 'a0000000-0000-0000-0000-000000000002', 'Progetto crediti CO2eq ambito', 'attiva'),
  ('b0000000-0000-0000-0000-000000000003', 'CWP-2026-0003', 'progetto', 'a0000000-0000-0000-0000-000000000003', 'Adesione gestore servizi', 'attiva')
on conflict (id) do nothing;

-- Genera le 7 fasi per ciascun progetto di esempio.
-- La fase 1 (Adesione) è "in_corso", le altre "non_iniziata".
insert into fase (pratica_id, numero, nome, responsabile, stato)
select p.id, v.numero, v.nome, v.responsabile,
       case when v.numero = 1 then 'in_corso'::stato_fase else 'non_iniziata'::stato_fase end
from pratica p
cross join (values
  (1, 'Adesione', 'Soggetto Promotore'),
  (2, 'Prima verifica documentale', 'Soggetto Promotore'),
  (3, 'Consultazione pubblica', 'Soggetto Promotore'),
  (4, 'Risposta ai commenti / pubblicazione', 'Soggetto Promotore'),
  (5, 'Validazione e verifica', 'Ente di Validazione'),
  (6, 'Seconda verifica documentale', 'Soggetto Promotore'),
  (7, 'Chiusura', 'Soggetto Promotore')
) as v(numero, nome, responsabile)
where p.id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003'
)
and not exists (select 1 from fase f where f.pratica_id = p.id and f.numero = v.numero);

-- =====================================================================
-- Per cancellare i dati di esempio (decommentare ed eseguire):
-- delete from pratica where id like 'b0000000-%';
-- delete from organizzazione where id like 'a0000000-%';
-- =====================================================================
