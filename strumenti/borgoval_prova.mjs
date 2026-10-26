/* =========================================================================
   borgoval_prova.mjs — dati di prova del Comune di Borgoval (26/10/2026).

   Richiesta di Luca Moretti del 26/10/2026 (ore 10:07):
   1. popolare Borgoval con i dati ISPRA di Casalmaggiore (CR), ultimi
      disponibili (Catasto rifiuti, anno 2024), con un bilancio positivo;
   2. simulazione con la differenziata che sale fino all'87% in 10 anni e
      margine (ricavi − costi) sempre positivo;
   3. calcolo dei crediti di Borgoval con le stesse ipotesi: 9.000 utenze
      domestiche «UtD1…UtD9000» e le non domestiche «UtND…» ricavate dalla
      quota non domestica dei rifiuti;
   4. svuotamenti per utenza; 5. calcolo dei crediti.

   Cosa fa: con il motore del simulatore e del calcolo del portale ricava i
   parametri e scrive lo script SQL strumenti/borgoval_prova.sql, che
   inserisce in produzione lo scenario, il calcolo (bozza) e le utenze
   (generate dentro il database con numeri pseudo-casuali riproducibili).
   Dati inventati: nessun dato personale (nomi «UtD…», indirizzi di prova).

   Uso: node strumenti/borgoval_prova.mjs   (stampa il riepilogo)
   Registro sviluppo e deploy: cronologia del 26/10/2026.
   ========================================================================= */
import fs from "fs";
import { simula, simulaEconomia, riepilogoAnnoBase, traiettoriaLineare, anniDelPeriodo, puntoDiPartenza, bufferMetodologia, economiaIniziale } from "../src/lib/crediti/simulatore.js";
import { produzioneAttesa, calcolaCrediti } from "../src/lib/crediti/calcolo.js";
import { TIPOLOGIE_RIFIUTO, BENI_RIUSO, BUFFER_SOLO_VIRTUOSE } from "../src/lib/crediti/parametri.js";

// Come datiIniziali() di archivio.js (che non si può importare qui perché
// apre il collegamento a Supabase).
function datiIniziali() {
  return {
    rifiuti: [], pefUd: "", pefUnd: "", classiUd: [], classiUnd: [],
    fattori: TIPOLOGIE_RIFIUTO.map((t) => ({ id: t.id, nome: t.nome, fe: t.fe, ps: t.ps, recupero: t.recupero, calcolato: !!t.calcolato, fonte: t.fonte })),
    scenarioRiuso: "riutilizzo",
    beni: BENI_RIUSO.map((b) => ({ id: b.id, nome: b.nome, peso: b.peso, fe: b.feRiutilizzo })),
    psConsuntivo: false, volumiCentralizzati: {},
    opzioni: {
      soloVirtuose: false, bufferVirtuose: BUFFER_SOLO_VIRTUOSE, utenzeMonitorate: { res: true, nonres: true, und: true },
      categorieUndNonMonitorate: 0, rifiutiMisurati: { indifferenziato: true }, misuraCentralizzate: false,
      misuraAltriNonCentralizzati: false, tariffaPuntuale: false, bufferManuale: "", motivazioneBuffer: "",
    },
  };
}

// --- Dati ISPRA, Catasto rifiuti, Casalmaggiore (ISTAT 019021), anno 2024, t/anno.
// Popolazione: 15.095 abitanti (2025). Le voci senza tipologia CWP (pulizia
// stradale a recupero 141,33 t, selettiva 15,72 t, altro 158,25 t) non
// entrano; gli ingombranti a smaltimento (2,42 t) vanno con l'indifferenziato.
// La frazione organica ISPRA comprende umido e verde (non separati).
export const ISPRA_CASALMAGGIORE_2024 = {
  organico: 2813.670, carta: 1225.219, vetro: 379.272, legno: 589.073, metallo: 143.754, plastica: 848.178,
  raee: 93.609, tessili: 51.245, inerti: 216.070, ingombranti: 397.630, indifferenziato: 1802.330 + 2.420,
};
export const POP_CASALMAGGIORE = 15095;
export const POP_BORGOVAL = 26382;
const RD_FINALE = 87;
const ANNO_INIZIO = 2027;
const VARIABILITA = 30; // % tra utenze (ipotesi del simulatore)
const r1 = (x) => Math.round(x * 10) / 10;

// --- 1-2. Scenario del simulatore.
const k = POP_BORGOVAL / POP_CASALMAGGIORE;
const rifiutiBase = {};
for (const [t, q] of Object.entries(ISPRA_CASALMAGGIORE_2024)) rifiutiBase[t] = String(r1(q * k));
const annoBase = { metodo: "anno", anno: "2024", popolazione: String(POP_BORGOVAL), cluster: "4", rifiuti: rifiutiBase };
const base = riepilogoAnnoBase(annoBase);
const attuale = { anno: "2024", popolazione: String(POP_BORGOVAL), proCapite: String(r1(base.proCapite)), seccoProCapite: String(r1(base.seccoProCapite)) };
const pp = puntoDiPartenza(base, attuale);
let anni = anniDelPeriodo({ durata: 10, annoInizio: ANNO_INIZIO, anni: [], base: pp });
anni = traiettoriaLineare({ anni, base: pp, proCapiteFinale: pp.proCapite, seccoProCapiteFinale: r1(pp.proCapite * (1 - RD_FINALE / 100)) });
const stimaUtenze = { utenze: "tutte", rifiuti: "rur_org", variabilita: VARIABILITA, altreTipologie: false, centriRaccolta: false, tariffaPuntuale: false };
const bufferPct = bufferMetodologia({ ...stimaUtenze, soloVirtuose: true }).totale; // 20 + 20 = 40%
const economia = { ...economiaIniziale(), prezzo: "32", listino: "caso1" };
export const scenario = { annoBase, attuale, bufferPct, metodoStima: "utenze", stimaUtenze, anni, economia };
const sim = simula(scenario);
const eco = simulaEconomia(sim.righe, economia, POP_BORGOVAL);

// --- 3. Calcolo dei crediti del primo anno (2027) con le stesse ipotesi.
// Rifiuti del territorio (passo 2) = scenario di riferimento dell'anno al
// 65% (Standard 4.8.1, come nel simulatore): così le emissioni attese delle
// utenze sono quelle dello scenario di riferimento.
const anno1 = sim.righe[0];
const RIF = { indifferenziato: anno1.seccoRiferimento };
Object.entries(sim.base.composizione).forEach(([t, q]) => { RIF[t] = anno1.riferimento * 0.65 * q; });
const PRJ = { indifferenziato: anno1.secco };
Object.entries(sim.base.composizione).forEach(([t, q]) => { PRJ[t] = anno1.differenziata * q; });
const EER = {
  organico: ["200108", "Rifiuti biodegradabili di cucine e mense e verde (frazione organica ISPRA)"],
  carta: ["200101", "Carta e cartone"], vetro: ["150107", "Imballaggi in vetro"], legno: ["200138", "Legno"],
  plastica: ["150102", "Imballaggi in plastica"], raee: ["200136", "RAEE"], tessili: ["200110", "Abbigliamento e tessili"],
  inerti: ["170904", "Rifiuti misti da costruzione e demolizione"], ingombranti: ["200307", "Ingombranti a recupero"],
  indifferenziato: ["200301", "Rifiuti urbani non differenziati"],
};
const rifiutiCalcolo = Object.entries(RIF).map(([t, q]) => ({
  codice: EER[t][0], descrizione: EER[t][1], tipologia: t, qtot: Math.round(q * 1000) / 1000, considerato: true, soloDomestiche: t === "inerti",
}));

// Delibera tariffaria di prova (coefficienti indicativi sul modello del DPR
// 158/1999, non la delibera reale di un Comune). PEF 70% UD, 30% UnD.
const PEF_UD = 70, PEF_UND = 30, N_UD = 9000;
const QUOTE_UD = [["1", 0.35, 0.8], ["2", 0.28, 1.6], ["3", 0.18, 2.05], ["4", 0.14, 2.6], ["5", 0.04, 3.25], ["6", 0.01, 3.75]];
const classiUd = QUOTE_UD.map(([classe, q, kb]) => ({ classe, n: Math.round(N_UD * q), kb }));
const CAT_UND = [
  ["1 - Musei, biblioteche, scuole, associazioni", 3, 400, 3.0], ["2 - Campeggi, distributori di carburante", 1, 300, 6.0],
  ["4 - Esposizioni, autosaloni", 1.7, 300, 4.5], ["5 - Alberghi con ristorante", 0.5, 900, 10.0],
  ["6 - Alberghi senza ristorante", 0.5, 600, 7.5], ["7 - Case di cura e riposo", 0.3, 1500, 9.5],
  ["8 - Uffici, agenzie, studi professionali", 22.7, 90, 8.5], ["9 - Banche e istituti di credito", 1.5, 250, 4.5],
  ["10 - Negozi di beni durevoli", 14, 110, 8.0], ["11 - Edicole, farmacie, tabaccherie", 4, 70, 11.0],
  ["12 - Botteghe artigiane (parrucchieri, estetisti)", 9, 60, 8.0], ["13 - Carrozzerie, autofficine, elettrauto", 5, 300, 8.5],
  ["14 - Attività industriali con capannoni", 8, 1200, 6.5], ["15 - Artigianato di produzione", 8, 400, 7.5],
  ["16 - Ristoranti, trattorie, pizzerie", 6, 150, 45.0], ["17 - Bar, caffè, pasticcerie", 7, 80, 35.0],
  ["18 - Supermercati e generi alimentari", 4, 400, 16.0], ["19 - Plurilicenze alimentari e miste", 1.5, 150, 15.0],
  ["20 - Ortofrutta, pescherie, fiori e piante", 2, 60, 50.0], ["21 - Discoteche, night club", 0.3, 400, 7.0],
];
// Numero delle utenze non domestiche: la quota non domestica dei rifiuti di
// riferimento (PEF 30%) divisa per la produzione media di un'utenza non
// domestica secondo la delibera (Kd × m², media pesata delle categorie).
const totRif = Object.values(RIF).reduce((s, q) => s + q, 0);
const prodMediaUnd = CAT_UND.reduce((s, [, q, mq, kd]) => s + (q / 100) * mq * kd, 0); // kg/anno
const N_UND = Math.round((totRif * 1000 * PEF_UND / 100) / prodMediaUnd);
const classiUnd = CAT_UND.map(([classe, q, mq, kd]) => ({ classe, n: Math.max(1, Math.round(N_UND * q / 100)), superficie: 0, kd, mq }));
classiUnd.forEach((c) => { c.superficie = c.n * c.mq; });
const nUndTot = classiUnd.reduce((s, c) => s + c.n, 0);

const att = produzioneAttesa({ rifiuti: rifiutiCalcolo, pefUd: PEF_UD, pefUnd: PEF_UND, classiUd, classiUnd });
const m = { indifferenziato: PRJ.indifferenziato / RIF.indifferenziato, organico: PRJ.organico / RIF.organico };
// Contenitori: svuotamenti = kg / (litri × peso specifico Tabella 8).
const KG_SVUOT = { UD: { indifferenziato: 120 * 0.08, organico: 25 * 0.25 }, UnD: { indifferenziato: 360 * 0.08, organico: 120 * 0.25 } };

const base0 = datiIniziali();
export const datiCalcolo = {
  ...base0,
  rifiuti: rifiutiCalcolo,
  pefUd: String(PEF_UD), pefUnd: String(PEF_UND),
  classiUd: classiUd.map(({ classe, n, kb }) => ({ classe, n, kb })),
  classiUnd: classiUnd.map(({ classe, n, superficie, kd }) => ({ classe, n, superficie, kd })),
  opzioni: { ...base0.opzioni, soloVirtuose: true, rifiutiMisurati: { indifferenziato: true, organico: true }, utenzeMonitorate: { res: true, nonres: true, und: true }, tariffaPuntuale: false },
  qualita: { popolazione: String(POP_BORGOVAL), cluster: "4", motivazione: "Dati di prova: quantità ISPRA 2024 del Comune di Casalmaggiore (CR) riportate a 26.382 abitanti e alla soglia del 65% di differenziata; scostamenti dalla Tabella 3 dovuti al profilo di Casalmaggiore." },
};

// Parametri per utenza (atteso della classe e rapporto medio progetto/riferimento).
const classiCalc = att.classi.map((c) => ({
  macro: c.macro, classe: c.classe, n: c.n,
  a_ind: c.atteso.indifferenziato, a_org: c.atteso.organico,
  mq: c.macro === "UnD" ? classiUnd.find((x) => x.classe === c.classe).mq : null,
}));

// Numeri pseudo-casuali riproducibili, uguali in JS e in SQL (hash intero).
const M32 = 4294967296n;
export function u(i, kk) {
  let h = (BigInt(i) * 2654435761n + BigInt(kk) * 97531n) % M32;
  h = h ^ (h >> 16n); h = (h * 73244475n) % M32; h = h ^ (h >> 16n);
  return (Number(h) + 0.5) / 4294967296;
}
const gauss = (i, kk) => Math.sqrt(-2 * Math.log(u(i, kk))) * Math.cos(2 * Math.PI * u(i, kk + 1));
const SIGMA = VARIABILITA / 100;

// Utenze generate in JS (per la verifica): stesse regole dello script SQL.
const utenze = [];
let iD = 0, iN = 0;
for (const c of classiCalc) {
  for (let j = 0; j < c.n; j++) {
    const ud = c.macro === "UD";
    const idx = ud ? ++iD : ++iN;
    const seme = ud ? idx : 100000 + idx;
    const kgI = r1(Math.max(0, c.a_ind * (m.indifferenziato + SIGMA * gauss(seme, 1))));
    const kgO = r1(Math.max(0, c.a_org * (m.organico + SIGMA * gauss(seme, 3))));
    const kv = KG_SVUOT[c.macro];
    utenze.push({
      codice: (ud ? "UtD" : "UtND") + idx, tipo: c.macro, categoria_simulazione: c.classe,
      frazioni: { indifferenziato: { kg: kgI, svuotamenti: Math.ceil(kgI / kv.indifferenziato) }, organico: { kg: kgO, svuotamenti: Math.ceil(kgO / kv.organico) } },
    });
  }
}
const ris = calcolaCrediti({ ...datiCalcolo, anno: ANNO_INIZIO, tipo: "ex_post", utenze });

// --- SQL.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const classiSql = classiCalc.map((c, n) => `(${n + 1}, ${q(c.macro)}, ${q(c.classe)}, ${c.n}, ${c.a_ind}, ${c.a_org}, ${c.mq ?? "null"})`).join(",\n  ");
const sql = `-- =====================================================================
--  DATI DI PROVA DEL COMUNE DI BORGOVAL (26/10/2026)
--  Generato da strumenti/borgoval_prova.mjs (richiesta di Luca Moretti del
--  26/10/2026): scenario del simulatore con i dati ISPRA 2024 di
--  Casalmaggiore (CR) e differenziata fino all'87%; calcolo dei crediti
--  2027 (bozza, da NON confermare) sul Progetto CWP-2026-0001 con
--  ${N_UD} utenze domestiche UtD… e ${nUndTot} non domestiche UtND… (dati inventati).
--  Rieseguibile: toglie prima lo scenario e il calcolo di prova con lo
--  stesso nome.
-- =====================================================================
begin;
delete from scenario_simulazione where nome = 'ISPRA Casalmaggiore 2024 - differenziata all''87% (per utenza)' and comune = 'Comune di Borgoval';
delete from calcolo_crediti where titolo = 'PROVA Borgoval 2027 - utenze generate (ISPRA Casalmaggiore) - non confermare' and stato = 'bozza';

insert into scenario_simulazione (organizzazione_id, comune, nome, note, durata, anno_inizio, dati, crediti_netti_totali, rd_finale, simulato_il)
select p.organizzazione_id, 'Comune di Borgoval', 'ISPRA Casalmaggiore 2024 - differenziata all''87% (per utenza)',
  ${q(`Dati di prova (richiesta di Luca del 26/10/2026). Scenario di riferimento: quantità del Catasto rifiuti ISPRA 2024 del Comune di Casalmaggiore (CR, ${POP_CASALMAGGIORE.toLocaleString("it-IT")} abitanti, differenziata ${base.rd.toFixed(1).replace(".", ",")}%) riportate ai ${POP_BORGOVAL.toLocaleString("it-IT")} abitanti di Borgoval; il calcolo le porta alla soglia del 65%. La frazione organica ISPRA comprende anche il verde. Obiettivo: produzione pro capite invariata, differenziata dal ${base.rd.toFixed(1).replace(".", ",")}% all'87% nel 2036. Metodo per utenza (solo utenze virtuose, secco e organico misurati, variabilità 30%), buffer 40% (Cap. 7: 20% utenze virtuose + 20% Tabella 16). Listino Caso 1, 32 € a credito.`)},
  10, ${ANNO_INIZIO}, ${q(JSON.stringify(scenario))}::jsonb, ${Math.round(sim.totali.netti * 100) / 100}, ${Math.round(sim.totali.rdFinale * 10) / 10}, now()
from pratica p where p.codice = 'CWP-2026-0001';

create temp table _c on commit drop as
with nuovo as (
  insert into calcolo_crediti (pratica_id, titolo, anno, tipo, note, dati)
  select p.id, 'PROVA Borgoval 2027 - utenze generate (ISPRA Casalmaggiore) - non confermare', ${ANNO_INIZIO}, 'ex_post',
    ${q("Dati di prova generati il 26/10/2026 (strumenti/borgoval_prova.mjs). Rifiuti del territorio = scenario di riferimento 2027 al 65% (ISPRA 2024 di Casalmaggiore riportati a 26.382 abitanti). Delibera tariffaria di prova (coefficienti indicativi sul modello del DPR 158/1999). Utenze inventate: kg di secco e organico misurati per utenza intorno al valore atteso della classe × rapporto progetto/riferimento dello scenario del simulatore (anno 2027), variabilità 30%; svuotamenti = kg / (litri del contenitore × peso specifico Tab. 8): domestiche 120 L secco e 25 L organico, non domestiche 360 L e 120 L. Solo utenze virtuose, buffer 40%. NON CONFERMARE.")},
    ${q(JSON.stringify(datiCalcolo))}::jsonb
  from pratica p where p.codice = 'CWP-2026-0001'
  returning id
) select id from nuovo;

-- Numeri pseudo-casuali riproducibili (stesso hash di borgoval_prova.mjs).
create temp table _cl (ord int, macro text, classe text, n int, a_ind numeric, a_org numeric, mq numeric) on commit drop;
insert into _cl values
  ${classiSql};

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
         round(greatest(0, c.a_ind * (${m.indifferenziato} + ${SIGMA} * pg_temp.g(r.seme, 1)))::numeric, 1) as ki,
         round(greatest(0, c.a_org * (${m.organico} + ${SIGMA} * pg_temp.g(r.seme, 3)))::numeric, 1) as ko,
         case when c.macro = 'UD' then ${KG_SVUOT.UD.indifferenziato} else ${KG_SVUOT.UnD.indifferenziato} end as vi,
         case when c.macro = 'UD' then ${KG_SVUOT.UD.organico} else ${KG_SVUOT.UnD.organico} end as vo
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
`;
fs.writeFileSync(new URL("./borgoval_prova.sql", import.meta.url), sql);

// --- Riepilogo.
const f = (x, d = 0) => Number(x).toLocaleString("it-IT", { maximumFractionDigits: d, minimumFractionDigits: d });
console.log(`Base Borgoval (ISPRA 2024 Casalmaggiore × ${k.toFixed(4)}): ${f(base.totale, 1)} t, ${f(base.proCapite, 1)} kg/ab, secco ${f(base.seccoProCapite, 1)} kg/ab, RD ${f(base.rd, 1)}%`);
sim.righe.forEach((r, i) => console.log(`${r.anno}  RD ${f(r.rd, 1)}%  netti ${f(r.netti)}  ricavi ${f(eco.righe[i].ricavi)} €  costi ${f(eco.righe[i].costi)} €  margine ${f(eco.righe[i].margine)} €`));
console.log(`Totale netti ${f(sim.totali.netti)}  ricavi ${f(eco.totali.ricavi)} €  costi ${f(eco.totali.costi)} €  margine ${f(eco.totali.margine)} €`);
console.log(`Rifiuti di riferimento 2027: ${f(totRif, 1)} t; progetto: secco ${f(PRJ.indifferenziato, 1)} t (m ${m.indifferenziato.toFixed(3)}), organico ${f(PRJ.organico, 1)} t (m ${m.organico.toFixed(3)})`);
console.log(`Utenze: ${N_UD} UD, ${nUndTot} UnD (produzione media UnD ${f(prodMediaUnd)} kg)`);
const sI = utenze.reduce((s, x) => s + x.frazioni.indifferenziato.kg, 0) / 1000, sO = utenze.reduce((s, x) => s + x.frazioni.organico.kg, 0) / 1000;
console.log(`Generate: secco ${f(sI, 1)} t, organico ${f(sO, 1)} t`);
console.log(`Calcolo 2027 (JS): lordi ${f(ris.crediti.lordi, 1)}  buffer ${ris.buffer.totale}%  netti ${f(ris.crediti.netti, 1)}  virtuose ${ris.utenze.virtuose}/${ris.utenze.totale}  ΔI tutte ${f(ris.utenze.deltaITutte / 1000, 1)} t  — simulatore 2027: lordi ${f(anno1.lordi, 1)} netti ${f(anno1.netti, 1)}`);
console.log("Avvisi calcolo:", ris.avvisi, ris.errori);
console.log("Avvisi simulatore:", sim.avvisi);
