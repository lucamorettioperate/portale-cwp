/* =========================================================================
   date.test.mjs — test delle utilità di data (src/lib/date.js)

   Scopo: verificare le date in ora italiana usate per aprire le
   consultazioni (30 giorni) e per i nomi dei file: oggiItalia() deve dare
   sempre aaaa-mm-gg in fuso Europe/Rome, aggiungiGiorni() deve contare i
   giorni sul calendario (fine mese, anno bisestile, ora legale).
   Uso: npm test (oppure node test/date.test.mjs).
   Esito: "✓" per prova e "N prove superate"; altrimenti si ferma con
   l'errore.
   Registro sviluppo e deploy: capitolo «Codice sorgente» (prove automatiche).
   ========================================================================= */
import assert from "node:assert/strict";
import { oggiItalia, aggiungiGiorni } from "../src/lib/date.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

prova("oggiItalia: formato aaaa-mm-gg", () => {
  assert.match(oggiItalia(), /^\d{4}-\d{2}-\d{2}$/);
});
prova("aggiungiGiorni: 30 giorni, cambio dell'ora legale e fine mese", () => {
  assert.equal(aggiungiGiorni("2026-10-18", 30), "2026-11-17");
  assert.equal(aggiungiGiorni("2026-03-20", 30), "2026-04-19");
  assert.equal(aggiungiGiorni("2026-12-15", 30), "2027-01-14");
});
prova("aggiungiGiorni: anno bisestile", () => {
  assert.equal(aggiungiGiorni("2028-02-28", 1), "2028-02-29");
  assert.equal(aggiungiGiorni("2027-02-28", 1), "2027-03-01");
});
console.log(`${n} prove superate`);
