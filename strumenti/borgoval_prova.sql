-- =====================================================================
--  DATI DI PROVA DEL COMUNE DI BORGOVAL (26/10/2026)
--  Generato da strumenti/borgoval_prova.mjs (richiesta di Luca Moretti del
--  26/10/2026): scenario del simulatore con i dati ISPRA 2024 di
--  Casalmaggiore (CR) e differenziata fino all'87%; calcolo dei crediti
--  2027 (bozza, da NON confermare) sul Progetto CWP-2026-0001 con
--  9000 utenze domestiche UtD… e 1778 non domestiche UtND… (dati inventati).
--  Rieseguibile: toglie prima lo scenario e il calcolo di prova con lo
--  stesso nome.
-- =====================================================================
begin;
delete from scenario_simulazione where nome = 'ISPRA Casalmaggiore 2024 - differenziata all''87% (per utenza)' and comune = 'Comune di Borgoval';
delete from calcolo_crediti where titolo = 'PROVA Borgoval 2027 - utenze generate (ISPRA Casalmaggiore) - non confermare' and stato = 'bozza';

insert into scenario_simulazione (organizzazione_id, comune, nome, note, durata, anno_inizio, dati, crediti_netti_totali, rd_finale, simulato_il)
select p.organizzazione_id, 'Comune di Borgoval', 'ISPRA Casalmaggiore 2024 - differenziata all''87% (per utenza)',
  'Dati di prova (richiesta di Luca del 26/10/2026). Scenario di riferimento: quantità del Catasto rifiuti ISPRA 2024 del Comune di Casalmaggiore (CR, 15.095 abitanti, differenziata 78,9%) riportate ai 26.382 abitanti di Borgoval; il calcolo le porta alla soglia del 65%. La frazione organica ISPRA comprende anche il verde. Obiettivo: produzione pro capite invariata, differenziata dal 78,9% all''87% nel 2036. Metodo per utenza (solo utenze virtuose, secco e organico misurati, variabilità 30%), buffer 40% (Cap. 7: 20% utenze virtuose + 20% Tabella 16). Listino Caso 1, 32 € a credito.',
  10, 2027, '{"annoBase":{"metodo":"anno","anno":"2024","popolazione":"26382","cluster":"4","rifiuti":{"organico":"4917.5","carta":"2141.4","vetro":"662.9","legno":"1029.5","metallo":"251.2","plastica":"1482.4","raee":"163.6","tessili":"89.6","inerti":"377.6","ingombranti":"695","indifferenziato":"3154.2"}},"attuale":{"anno":"2024","popolazione":"26382","proCapite":"567.2","seccoProCapite":"119.6"},"bufferPct":40,"metodoStima":"utenze","stimaUtenze":{"utenze":"tutte","rifiuti":"rur_org","variabilita":30,"altreTipologie":false,"centriRaccolta":false,"tariffaPuntuale":false},"anni":[{"anno":2027,"popolazione":26382,"totale":14963.9,"seccoProCapite":115},{"anno":2028,"popolazione":26382,"totale":14963.9,"seccoProCapite":110.4},{"anno":2029,"popolazione":26382,"totale":14963.9,"seccoProCapite":105.8},{"anno":2030,"popolazione":26382,"totale":14963.9,"seccoProCapite":101.2},{"anno":2031,"popolazione":26382,"totale":14963.9,"seccoProCapite":96.7},{"anno":2032,"popolazione":26382,"totale":14963.9,"seccoProCapite":92.1},{"anno":2033,"popolazione":26382,"totale":14963.9,"seccoProCapite":87.5},{"anno":2034,"popolazione":26382,"totale":14963.9,"seccoProCapite":82.9},{"anno":2035,"popolazione":26382,"totale":14963.9,"seccoProCapite":78.3},{"anno":2036,"popolazione":26382,"totale":14963.9,"seccoProCapite":73.7}],"economia":{"prezzo":"32","prezzi":{},"prezzoMin":"","prezzoMax":"","crescitaPrezzo":0,"listino":"caso1","costoValidazione":"","costoVerificaAnnua":"","altriCostiAnnui":""}}'::jsonb, 58640.16, 87, now()
from pratica p where p.codice = 'CWP-2026-0001';

create temp table _c on commit drop as
with nuovo as (
  insert into calcolo_crediti (pratica_id, titolo, anno, tipo, note, dati)
  select p.id, 'PROVA Borgoval 2027 - utenze generate (ISPRA Casalmaggiore) - non confermare', 2027, 'ex_post',
    'Dati di prova generati il 26/10/2026 (strumenti/borgoval_prova.mjs). Rifiuti del territorio = scenario di riferimento 2027 al 65% (ISPRA 2024 di Casalmaggiore riportati a 26.382 abitanti). Delibera tariffaria di prova (coefficienti indicativi sul modello del DPR 158/1999). Utenze inventate: kg di secco e organico misurati per utenza intorno al valore atteso della classe × rapporto progetto/riferimento dello scenario del simulatore (anno 2027), variabilità 30%; svuotamenti = kg / (litri del contenitore × peso specifico Tab. 8): domestiche 120 L secco e 25 L organico, non domestiche 360 L e 120 L. Solo utenze virtuose, buffer 40%. NON CONFERMARE.',
    '{"rifiuti":[{"codice":"200301","descrizione":"Rifiuti urbani non differenziati","tipologia":"indifferenziato","qtot":5237.715,"considerato":true,"soloDomestiche":false},{"codice":"200108","descrizione":"Rifiuti biodegradabili di cucine e mense e verde (frazione organica ISPRA)","tipologia":"organico","qtot":4138.019,"considerato":true,"soloDomestiche":false},{"codice":"200101","descrizione":"Carta e cartone","tipologia":"carta","qtot":1801.963,"considerato":true,"soloDomestiche":false},{"codice":"150107","descrizione":"Imballaggi in vetro","tipologia":"vetro","qtot":557.823,"considerato":true,"soloDomestiche":false},{"codice":"200138","descrizione":"Legno","tipologia":"legno","qtot":866.312,"considerato":true,"soloDomestiche":false},{"codice":"150102","descrizione":"Imballaggi in plastica","tipologia":"plastica","qtot":1247.422,"considerato":true,"soloDomestiche":false},{"codice":"200136","descrizione":"RAEE","tipologia":"raee","qtot":137.667,"considerato":true,"soloDomestiche":false},{"codice":"200110","descrizione":"Abbigliamento e tessili","tipologia":"tessili","qtot":75.397,"considerato":true,"soloDomestiche":false},{"codice":"170904","descrizione":"Rifiuti misti da costruzione e demolizione","tipologia":"inerti","qtot":317.746,"considerato":true,"soloDomestiche":true},{"codice":"200307","descrizione":"Ingombranti a recupero","tipologia":"ingombranti","qtot":584.834,"considerato":true,"soloDomestiche":false}],"pefUd":"70","pefUnd":"30","classiUd":[{"classe":"1","n":3150,"kb":0.8},{"classe":"2","n":2520,"kb":1.6},{"classe":"3","n":1620,"kb":2.05},{"classe":"4","n":1260,"kb":2.6},{"classe":"5","n":360,"kb":3.25},{"classe":"6","n":90,"kb":3.75}],"classiUnd":[{"classe":"1 - Musei, biblioteche, scuole, associazioni","n":53,"superficie":21200,"kd":3},{"classe":"2 - Campeggi, distributori di carburante","n":18,"superficie":5400,"kd":6},{"classe":"4 - Esposizioni, autosaloni","n":30,"superficie":9000,"kd":4.5},{"classe":"5 - Alberghi con ristorante","n":9,"superficie":8100,"kd":10},{"classe":"6 - Alberghi senza ristorante","n":9,"superficie":5400,"kd":7.5},{"classe":"7 - Case di cura e riposo","n":5,"superficie":7500,"kd":9.5},{"classe":"8 - Uffici, agenzie, studi professionali","n":404,"superficie":36360,"kd":8.5},{"classe":"9 - Banche e istituti di credito","n":27,"superficie":6750,"kd":4.5},{"classe":"10 - Negozi di beni durevoli","n":249,"superficie":27390,"kd":8},{"classe":"11 - Edicole, farmacie, tabaccherie","n":71,"superficie":4970,"kd":11},{"classe":"12 - Botteghe artigiane (parrucchieri, estetisti)","n":160,"superficie":9600,"kd":8},{"classe":"13 - Carrozzerie, autofficine, elettrauto","n":89,"superficie":26700,"kd":8.5},{"classe":"14 - Attività industriali con capannoni","n":142,"superficie":170400,"kd":6.5},{"classe":"15 - Artigianato di produzione","n":142,"superficie":56800,"kd":7.5},{"classe":"16 - Ristoranti, trattorie, pizzerie","n":107,"superficie":16050,"kd":45},{"classe":"17 - Bar, caffè, pasticcerie","n":124,"superficie":9920,"kd":35},{"classe":"18 - Supermercati e generi alimentari","n":71,"superficie":28400,"kd":16},{"classe":"19 - Plurilicenze alimentari e miste","n":27,"superficie":4050,"kd":15},{"classe":"20 - Ortofrutta, pescherie, fiori e piante","n":36,"superficie":2160,"kd":50},{"classe":"21 - Discoteche, night club","n":5,"superficie":2000,"kd":7}],"fattori":[{"id":"organico","nome":"Frazione organica","fe":-3.66,"ps":250,"recupero":true,"calcolato":false,"fonte":"Tab. 3 – USEPA WARM 2019"},{"id":"verde","nome":"Scarto verde","fe":-0.76,"ps":null,"recupero":true,"calcolato":false,"fonte":"Tab. 3 – USEPA WARM 2019"},{"id":"carta","nome":"Carta e cartone","fe":-6.07,"ps":33,"recupero":true,"calcolato":false,"fonte":"Tab. 3 – USEPA WARM 2019"},{"id":"vetro","nome":"Vetro","fe":-0.53,"ps":150,"recupero":true,"calcolato":false,"fonte":"Tab. 3 – USEPA WARM 2019"},{"id":"legno","nome":"Legno","fe":-2.11,"ps":null,"recupero":true,"calcolato":false,"fonte":"Tab. 3 – USEPA WARM 2019"},{"id":"plastica","nome":"Plastica","fe":-1.87,"ps":10,"recupero":true,"calcolato":false,"fonte":"Tab. 3 – USEPA WARM 2019"},{"id":"metallo","nome":"Metallo","fe":null,"ps":10,"recupero":true,"calcolato":false,"fonte":"da indicare nel Progetto"},{"id":"inerti","nome":"Rifiuti inerti","fe":-0.11,"ps":null,"recupero":true,"calcolato":false,"fonte":"Tab. 3 – USEPA WARM 2019"},{"id":"tessili","nome":"Tessili","fe":-12,"ps":null,"recupero":true,"calcolato":false,"fonte":"Tab. 4 – WRAP 2011"},{"id":"raee","nome":"RAEE","fe":-4.87,"ps":null,"recupero":true,"calcolato":false,"fonte":"Tab. 4 – WRAP 2011"},{"id":"ingombranti","nome":"Ingombranti","fe":-0.98,"ps":null,"recupero":true,"calcolato":false,"fonte":"Tab. 4 – WRAP 2011"},{"id":"indifferenziato","nome":"Indifferenziato (EER 200301)","fe":null,"ps":80,"recupero":false,"calcolato":true,"fonte":"Formule 16-17"}],"scenarioRiuso":"riutilizzo","beni":[{"id":"maglietta","nome":"Maglietta","peso":0.25,"fe":-12.8},{"id":"maglione","nome":"Maglione","peso":0.5,"fe":-9.22},{"id":"vestito","nome":"Vestito generico","peso":0.4,"fe":-12},{"id":"mobile","nome":"Mobile generico","peso":30,"fe":-0.98},{"id":"aee","nome":"AEE generici","peso":15.5,"fe":-4.87}],"psConsuntivo":false,"volumiCentralizzati":{},"opzioni":{"soloVirtuose":true,"bufferVirtuose":20,"utenzeMonitorate":{"res":true,"nonres":true,"und":true},"categorieUndNonMonitorate":0,"rifiutiMisurati":{"indifferenziato":true,"organico":true},"misuraCentralizzate":false,"misuraAltriNonCentralizzati":false,"tariffaPuntuale":false,"bufferManuale":"","motivazioneBuffer":""},"qualita":{"popolazione":"26382","cluster":"4","motivazione":"Dati di prova: quantità ISPRA 2024 del Comune di Casalmaggiore (CR) riportate a 26.382 abitanti e alla soglia del 65% di differenziata; scostamenti dalla Tabella 3 dovuti al profilo di Casalmaggiore."}}'::jsonb
  from pratica p where p.codice = 'CWP-2026-0001'
  returning id
) select id from nuovo;

-- Numeri pseudo-casuali riproducibili (stesso hash di borgoval_prova.mjs).
create temp table _cl (ord int, macro text, classe text, n int, a_ind numeric, a_org numeric, mq numeric) on commit drop;
insert into _cl values
  (1, 'UD', '1', 3150, 198.26361833082777, 156.63674324809838, null),
  (2, 'UD', '2', 2520, 396.5272366616556, 313.27348649619677, null),
  (3, 'UD', '3', 1620, 508.05052197274614, 401.38165457325204, null),
  (4, 'UD', '4', 1260, 644.3567595751904, 509.06941555631977, null),
  (5, 'UD', '5', 360, 805.4459494689879, 636.3367694453997, null),
  (6, 'UD', '6', 90, 929.3607109257553, 734.2347339754613, null),
  (7, 'UnD', '1 - Musei, biblioteche, scuole, associazioni', 53, 429.40245672252047, 339.2463172517915, 400),
  (8, 'UnD', '2 - Campeggi, distributori di carburante', 18, 644.1036850837806, 508.86947587768725, 300),
  (9, 'UnD', '4 - Esposizioni, autosaloni', 30, 483.0777638128355, 381.6521069082654, 300),
  (10, 'UnD', '5 - Alberghi con ristorante', 9, 3220.518425418903, 2544.347379388436, 900),
  (11, 'UnD', '6 - Alberghi senza ristorante', 9, 1610.2592127094515, 1272.173689694218, 600),
  (12, 'UnD', '7 - Case di cura e riposo', 5, 5099.15417357993, 4028.550017365024, 1500),
  (13, 'UnD', '8 - Uffici, agenzie, studi professionali', 404, 273.7440661606068, 216.26952724801706, 90),
  (14, 'UnD', '9 - Banche e istituti di credito', 27, 402.5648031773629, 318.0434224235545, 250),
  (15, 'UnD', '10 - Negozi di beni durevoli', 249, 314.8951349298483, 248.78063265131374, 110),
  (16, 'UnD', '11 - Edicole, farmacie, tabaccherie', 71, 275.53324306361725, 217.68305356989953, 70),
  (17, 'UnD', '12 - Botteghe artigiane (parrucchieri, estetisti)', 160, 171.7609826890082, 135.6985269007166, 60),
  (18, 'UnD', '13 - Carrozzerie, autofficine, elettrauto', 89, 912.4802205353559, 720.8984241600568, 300),
  (19, 'UnD', '14 - Attività industriali con capannoni', 142, 2791.115968696383, 2205.101062136645, 1200),
  (20, 'UnD', '15 - Artigianato di produzione', 142, 1073.506141806301, 848.1157931294787, 400),
  (21, 'UnD', '16 - Ristoranti, trattorie, pizzerie', 107, 2415.3888190641774, 1908.260534541327, 150),
  (22, 'UnD', '17 - Bar, caffè, pasticcerie', 124, 1001.939065685881, 791.57474025418, 80),
  (23, 'UnD', '18 - Supermercati e generi alimentari', 71, 2290.146435853442, 1809.3136920095544, 400),
  (24, 'UnD', '19 - Plurilicenze alimentari e miste', 27, 805.1296063547258, 636.086844847109, 150),
  (25, 'UnD', '20 - Ortofrutta, pescherie, fiori e piante', 36, 1073.506141806301, 848.1157931294788, 60),
  (26, 'UnD', '21 - Discoteche, night club', 5, 1001.939065685881, 791.57474025418, 400);

create or replace function pg_temp.u(i bigint, k bigint) returns double precision language sql immutable as $$
  select ((h3 # (h3 >> 16))::double precision + 0.5) / 4294967296.0 from (
    select (h2 * 73244475) % 4294967296 as h3 from (
      select h1 # (h1 >> 16) as h2 from (select (i * 2654435761 + k * 97531) % 4294967296 as h1) a) b) c $$;
create or replace function pg_temp.g(i bigint, k bigint) returns double precision language sql immutable as $$
  select sqrt(-2 * ln(pg_temp.u(i, k))) * cos(2 * pi() * pg_temp.u(i, k + 1)) $$;

insert into calcolo_utenza (calcolo_id, codice, tipo, nominativo, indirizzo, componenti, mq, categoria_tariffaria, categoria_simulazione, produzione_totale_kg, frazioni)
select (select id from _c), x.cod, x.macro, x.cod, 'Via di prova ' || x.idx || ', Borgoval',
       case when x.macro = 'UD' then least(x.classe::int, 6) end,
       case when x.macro = 'UD' then round((45 + 18 * x.classe::int + 30 * pg_temp.u(x.seme, 5))::numeric, 0)
            else round((x.mq * (0.6 + 0.8 * pg_temp.u(x.seme, 5)))::numeric, 0) end,
       x.classe, x.classe, x.ki + x.ko,
       jsonb_build_object('indifferenziato', jsonb_build_object('kg', x.ki, 'svuotamenti', ceil(x.ki / x.vi)::int),
                          'organico', jsonb_build_object('kg', x.ko, 'svuotamenti', ceil(x.ko / x.vo)::int))
from (
  select c.macro, c.classe, c.mq, r.idx, r.seme,
         case when c.macro = 'UD' then 'UtD' else 'UtND' end || r.idx as cod,
         round(greatest(0, c.a_ind * (0.5792468662384265 + 0.3 * pg_temp.g(r.seme, 1)))::numeric, 1) as ki,
         round(greatest(0, c.a_org * (1.2264565750522889 + 0.3 * pg_temp.g(r.seme, 3)))::numeric, 1) as ko,
         case when c.macro = 'UD' then 9.6 else 28.8 end as vi,
         case when c.macro = 'UD' then 6.25 else 30 end as vo
  from _cl c
  cross join lateral (
    select g + coalesce((select sum(c2.n) from _cl c2 where c2.macro = c.macro and c2.ord < c.ord), 0) as idx
    from generate_series(1, c.n) g) r0
  cross join lateral (select r0.idx::bigint as idx, case when c.macro = 'UD' then r0.idx else 100000 + r0.idx end::bigint as seme) r
) x;

-- Controllo (sola lettura).
select (select count(*) from calcolo_utenza where calcolo_id = (select id from _c) and tipo = 'UD') as domestiche,
       (select count(*) from calcolo_utenza where calcolo_id = (select id from _c) and tipo = 'UnD') as non_domestiche,
       (select round(sum((frazioni->'indifferenziato'->>'kg')::numeric) / 1000, 1) from calcolo_utenza where calcolo_id = (select id from _c)) as secco_t,
       (select round(sum((frazioni->'organico'->>'kg')::numeric) / 1000, 1) from calcolo_utenza where calcolo_id = (select id from _c)) as organico_t,
       (select id from _c) as calcolo_id;
commit;
