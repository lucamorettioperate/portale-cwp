/* =========================================================================
   rilievi_t2.test.mjs — prove dei rilievi nuovi del secondo collaudo
   («TEST_PORTALE_CWP_2», mandato da Luca Moretti il 9/11/2026):
   - T32: sei fasi come nella Guida, registrazione = esito della fase 6;
   - T33: scenari del simulatore salvati con regole precedenti rivalutati
     con le regole di oggi (valutaScenario, riepilogoDaAggiornare).
   T34 (risultati non aggiornati all'apertura del calcolo) usa il motore
   del calcolo già provato in crediti.test.mjs; le regole del database
   sono provate in t49.sql.
   Uso: node test/rilievi_t2.test.mjs (anche dentro npm test).
   ========================================================================= */
import assert from "node:assert/strict";
import { FASI, FASI_RAPPORTO, NUMERO_FASI, statoProgramma } from "../src/lib/cwpProgram.js";
import { valutaScenario, riepilogoDaAggiornare } from "../src/lib/crediti/simulatore.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

prova("T32: sei fasi per Progetto e Rapporto, registrazione alla chiusura della fase 6", () => {
  assert.equal(NUMERO_FASI, 6);
  assert.deepEqual(FASI.map((f) => f.numero), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(FASI_RAPPORTO.map((f) => f.numero), [1, 2, 3, 4, 5, 6]);
  const fasi = FASI.map((f) => ({ numero: f.numero, stato: "completata" }));
  assert.equal(statoProgramma({ stato: "attiva", tipo: "progetto" }, fasi), "progetto registrato");
  assert.equal(statoProgramma({ stato: "attiva", tipo: "rapporto" }, fasi), "rapporto registrato e crediti registrati");
});

// Scenario con il riferimento di Casalmaggiore 2024 (78,9% di
// differenziata), come quello di prova di Borgoval del 26/10.
const casalmaggiore = {
  organico: 2813.67, carta: 1225.219, vetro: 379.272, legno: 589.073, metallo: 143.754, plastica: 848.178,
  raee: 93.609, tessili: 51.245, inerti: 216.07, ingombranti: 397.63, indifferenziato: 1804.75,
};
const scenario = (rifiuti, extra = {}) => ({
  durata: 10,
  anno_inizio: 2027,
  dati: { annoBase: { metodo: "anno", anno: 2024, popolazione: 15095, rifiuti }, ...extra },
});

prova("T33: uno scenario salvato con il riferimento al 78,9% non è più ammesso", () => {
  const v = valutaScenario(scenario(casalmaggiore));
  assert.equal(v.ammesso, false);
  assert.match(v.errori[0], /78,9% di differenziata/);
  assert.equal(v.campi.crediti_netti_totali, null);
  // Salvato a suo tempo con 58.640 crediti: da aggiornare.
  assert.equal(riepilogoDaAggiornare({ ...scenario(casalmaggiore), crediti_netti_totali: 58640.2, ammesso: true }, v), true);
});

prova("T33: uno scenario ammesso dà le stesse colonne di «Salva» e confronta i totali salvati", () => {
  const s = scenario({ organico: 650, indifferenziato: 350 });
  const v = valutaScenario(s);
  assert.equal(v.ammesso, true);
  assert.equal(typeof v.campi.crediti_netti_totali, "number");
  assert.equal(v.campi.ammesso, true);
  assert.equal(riepilogoDaAggiornare({ ...s, ...v.campi }, v), false);
  assert.equal(riepilogoDaAggiornare({ ...s, ...v.campi, crediti_netti_totali: v.campi.crediti_netti_totali + 5 }, v), true);
  // Arrotondamento del salvataggio: entro 0,1 crediti non conta.
  assert.equal(riepilogoDaAggiornare({ ...s, ...v.campi, crediti_netti_totali: v.campi.crediti_netti_totali + 0.05 }, v), false);
});

console.log(`${n} prove superate (rilievi del secondo collaudo).`);
