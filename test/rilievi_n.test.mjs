/* =========================================================================
   rilievi_n.test.mjs — prove dei rilievi N01, N04, N05 e N06 della terza
   sessione di collaudo (CWP_NUOVI_RILIEVI_A_MORETTI_V01_20261021).
   N02 e N03 sono regole del database: le prove sono sul banco PostgreSQL
   isolato (script 39), descritte in docs/collaudo/Rilievi_N01-N06_risposte.md.
   - N01: voci «una tantum» del Caso 1/2 = rata annua di un corrispettivo
     pagato in 10 rate; durate diverse da 10 anni segnalate come stima.
   - N04: fase aperta senza data contata a parte; in scadenza/scadute con
     data assente, passata, oggi, +7, +8; pratica non attiva esclusa.
   - N05: il formato automatico CWP-AAAA-NNNN (controllo dell'avviso).
   - N06: fattore dell'indifferenziato con le cinque frazioni nominate più
     una tipologia aggiuntiva con FE noto, una senza FE, una a zero:
     confronto con un calcolo indipendente; denominatore nullo.
   Uso: npm test (oppure node test/rilievi_n.test.mjs).
   Registro sviluppo e deploy: capitolo «Collaudo».
   ========================================================================= */
import assert from "node:assert/strict";
import { costiPerCaso, simulaEconomia, DURATA_TARIFFE, NOTA_UNA_TANTUM } from "../src/lib/crediti/simulatore.js";
import { fattoreIndifferenziato, PANIERE_METODOLOGIA } from "../src/lib/crediti/calcolo.js";
import { TIPOLOGIE_RIFIUTO } from "../src/lib/crediti/parametri.js";
import { inScadenza, scaduta, senzaScadenza } from "../src/lib/scadenze.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };
const vicino = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// ---------------------------------------------------------------- N01
const POP = 16735; // Bovisio-Masciago, scenario del rilievo
prova("N01: Caso 1, 16.735 abitanti, importi annui del rilievo", () => {
  const c = costiPerCaso("caso1", POP);
  const v = Object.fromEntries(c.map((x) => [x.voce, x]));
  assert.equal(v.progetto.unitario, 0.13);
  vicino(v.progetto.importo, 2175.55, 1e-6);
  vicino(v.regProgetto.importo, 1673.5, 1e-6);
  vicino(v.regCreditiProgetto.importo, 2008.2, 1e-6);
  vicino(c.reduce((s, x) => s + x.importo, 0), 16232.95, 1e-6);
  ["progetto", "regProgetto", "regCreditiProgetto"].forEach((k) => assert.match(v[k].nome, /una tantum, in 10 rate annuali/));
  assert.match(NOTA_UNA_TANTUM, /10 rate annuali/);
});
const righe = (anni) => Array.from({ length: anni }, (_, i) => ({ anno: 2027 + i, netti: 1000 }));
for (const caso of ["caso1", "caso2"]) {
  prova(`N01: ${caso}, 10 anni: primo anno = anni successivi = rata, totale = 10 rate, nessun avviso`, () => {
    const annuo = costiPerCaso(caso, POP).reduce((s, x) => s + x.importo, 0);
    const e = simulaEconomia(righe(DURATA_TARIFFE), { prezzo: 32, listino: caso }, POP);
    assert.equal(e.durataFuoriListino, false);
    e.righe.forEach((r) => vicino(r.partecipazione + r.consulenza, annuo, 1e-6));
    vicino(e.totali.tariffeProgramma, annuo * 10, 1e-6);
    assert.ok(!e.avvisi.some((a) => /NON sono un listino approvato/.test(a)));
  });
  prova(`N01: ${caso}, 7 e 12 anni: segnalato come stima senza regola`, () => {
    for (const anni of [7, 12]) {
      const e = simulaEconomia(righe(anni), { prezzo: 32, listino: caso }, POP);
      assert.equal(e.durataFuoriListino, true);
      assert.ok(e.avvisi.some((a) => a.includes(`Per ${anni} anni la regola non è ancora stabilita`)));
    }
  });
}
prova("N01: listino «schema» e «nessuno» non sono segnalati (regole diverse)", () => {
  for (const listino of ["schema", "nessuno"]) {
    const e = simulaEconomia(righe(7), { prezzo: 32, listino }, POP);
    assert.equal(e.durataFuoriListino, false);
  }
});

// ---------------------------------------------------------------- N04
const riga = (stato, fase_stato, fase_scadenza, giorni_scadenza) => ({ stato, fase_stato, fase_scadenza, giorni_scadenza });
prova("N04: data assente = senza scadenza, non in scadenza né scaduta", () => {
  const p = riga("attiva", "in_corso", null, null);
  assert.equal(senzaScadenza(p), true);
  assert.equal(inScadenza(p), false);
  assert.equal(scaduta(p), false);
  assert.equal(senzaScadenza(riga("attiva", "in_attesa_integrazione", null, null)), true);
});
prova("N04: passata, oggi, +7, +8", () => {
  assert.equal(scaduta(riga("attiva", "in_corso", "2026-10-21", -1)), true);
  assert.equal(inScadenza(riga("attiva", "in_corso", "2026-10-22", 0)), true);
  assert.equal(inScadenza(riga("attiva", "in_corso", "2026-10-29", 7)), true);
  assert.equal(inScadenza(riga("attiva", "in_corso", "2026-10-30", 8)), false);
  assert.equal(scaduta(riga("attiva", "in_corso", "2026-10-30", 8)), false);
  assert.equal(senzaScadenza(riga("attiva", "in_corso", "2026-10-30", 8)), false);
});
prova("N04: pratica non attiva e fase non aperta escluse da tutti e tre", () => {
  for (const stato of ["sospesa", "chiusa", "annullata", "ritirata"]) {
    assert.equal(senzaScadenza(riga(stato, "in_corso", null, null)), false);
    assert.equal(scaduta(riga(stato, "in_corso", "2026-10-01", -21)), false);
    assert.equal(inScadenza(riga(stato, "in_corso", "2026-10-22", 0)), false);
  }
  assert.equal(senzaScadenza(riga("attiva", "non_iniziata", null, null)), false);
  assert.equal(senzaScadenza(riga("attiva", "completata", null, null)), false);
});

// ---------------------------------------------------------------- N05
const FORMATO = /^CWP-\d{4}-\d{4}$/; // lo stesso di NuovoProgetto.jsx
prova("N05: avviso solo per i codici fuori dal formato automatico", () => {
  assert.ok(FORMATO.test("CWP-2026-0001"));
  ["CWP-2026-003", "cwp-026-005", "cwp-2026-0001", "CWP-2026-00001"].forEach((c) => assert.ok(!FORMATO.test(c), c));
});

// ---------------------------------------------------------------- N06
const FATTORI = Object.fromEntries(TIPOLOGIE_RIFIUTO.map((t) => [t.id, t]));
// Cinque frazioni nominate + legno (FE noto) + metallo (FE mancante) + RAEE a zero.
const Q = { organico: 60, carta: 30, vetro: 20, plastica: 10, tessili: 5, legno: 15, metallo: 8, raee: 0, indifferenziato: 100 };
const indipendente = (ids) => {
  const num = ids.reduce((s, t) => s + Q[t] * FATTORI[t].fe, 0);
  const den = ids.reduce((s, t) => s + Q[t], 0);
  return num / den;
};
prova("N06: criterio attuale = tutte le frazioni a recupero con FE (calcolo indipendente)", () => {
  const r = fattoreIndifferenziato(Q, FATTORI);
  vicino(r.fe, indipendente([...PANIERE_METODOLOGIA, "legno"]));
  // Le due regole danno risultati diversi: la fixture distingue davvero i panieri.
  assert.ok(Math.abs(r.fe - indipendente(PANIERE_METODOLOGIA)) > 0.01);
  assert.deepEqual(r.fuoriPaniere, ["legno"]);
  assert.deepEqual(r.escluse, ["metallo"]);
  const leg = r.composizione.find((c) => c.tipologia === "legno");
  assert.equal(leg.quantita, 15);
  assert.equal(leg.fe, -2.11);
  vicino(r.composizione.reduce((s, c) => s + c.quota, 0), 1);
  assert.ok(!r.composizione.some((c) => c.tipologia === "raee" || c.tipologia === "indifferenziato"));
});
prova("N06: solo le cinque frazioni = nessuna segnalazione", () => {
  const solo = Object.fromEntries(PANIERE_METODOLOGIA.map((t) => [t, Q[t]]));
  const r = fattoreIndifferenziato(solo, FATTORI);
  assert.deepEqual(r.fuoriPaniere, []);
  vicino(r.fe, indipendente(PANIERE_METODOLOGIA));
});
prova("N06: denominatore nullo e solo frazioni senza FE = nessun fattore", () => {
  assert.equal(fattoreIndifferenziato({ organico: 0, carta: 0 }, FATTORI).fe, null);
  const r = fattoreIndifferenziato({ metallo: 5 }, FATTORI);
  assert.equal(r.fe, null);
  assert.deepEqual(r.escluse, ["metallo"]);
});

console.log(`\nRilievi N: ${n} prove superate`);
