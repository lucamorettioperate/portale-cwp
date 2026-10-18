/* =========================================================================
   tariffe.test.mjs — test dello Schema tariffario (src/lib/tariffe.js)

   Scopo: verificare gli importi proposti per le voci di pagamento con gli
   esempi dello Schema tariffario v1.2: fasce di popolazione, quote per
   credito previsto, scaglioni cumulativi di emissione e minimo di vendita.
   Uso: npm test (oppure node test/tariffe.test.mjs).
   Esito: "✓" per prova e "N prove superate"; altrimenti si ferma con
   l'errore.
   Registro sviluppo e deploy: capitolo «Codice sorgente» (prove automatiche).
   ========================================================================= */
import assert from "node:assert/strict";
import { aScaglioni, tariffaEmissione, tariffaVendita, saldoPerPopolazione, proposteTariffe, SALDO_PROGETTO, SALDO_RAPPORTO, SCAGLIONI_MINIMO_VENDITA } from "../src/lib/tariffe.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

prova("emissione: esempio dello Schema (2.000 crediti = 1.500 €)", () => {
  assert.equal(tariffaEmissione(2000), 1500);
  assert.equal(tariffaEmissione(1000), 1000);
  assert.equal(tariffaEmissione(12000), 1000 + 4500 + 600);
  assert.equal(tariffaEmissione(0), 0);
});
prova("fasce di popolazione: confini inclusi", () => {
  assert.equal(saldoPerPopolazione(5000, SALDO_PROGETTO), 1000);
  assert.equal(saldoPerPopolazione(5001, SALDO_PROGETTO), 2000);
  assert.equal(saldoPerPopolazione(100001, SALDO_PROGETTO), 12000);
  assert.equal(saldoPerPopolazione(30000, SALDO_RAPPORTO), 2000);
  assert.equal(saldoPerPopolazione(null, SALDO_RAPPORTO), null);
});
prova("vendita: 20% del valore o minimo a scaglioni", () => {
  assert.equal(aScaglioni(600, SCAGLIONI_MINIMO_VENDITA), 500 * 1.5 + 100 * 1.75);
  assert.equal(tariffaVendita(600, 1000), 925);
  assert.equal(tariffaVendita(600, 10000), 2000);
});
prova("proposte per Progetto e Rapporto", () => {
  const p = proposteTariffe({ tipo: "progetto", popolazione: 12000, crediti_previsti: 5000 });
  assert.deepEqual(p.map((v) => [v.voce, v.importo]), [["iscrizione", 3000], ["registrazione", 4750]]);
  const r = proposteTariffe({ tipo: "rapporto", popolazione: 4000, crediti_previsti: 1500 });
  assert.deepEqual(r.map((v) => [v.voce, v.importo]), [["iscrizione", 1000], ["registrazione", 800], ["emissione", 1250]]);
  const vuoto = proposteTariffe({ tipo: "progetto" });
  assert.equal(vuoto[1].importo, null);
});
console.log(`${n} prove superate`);
