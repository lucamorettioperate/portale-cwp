/* =========================================================================
   valoreProgetti.test.mjs — valore dei Progetti per il cliente con il
   listino del Caso 1 o del Caso 2 (richiesta di Luca Moretti del
   23/10/2026; src/lib/crediti/simulatore.js, valoreProgettoCaso e
   valoreProgetti; Dashboard e dati della pratica, script 43).
   Controlla: somma annua uguale alle tabelle (costiPerCaso), totale su 10
   anni, Caso 2 più caro del Caso 1, periodo di 7 anni segnato come stima,
   Progetti senza caso o senza popolazione contati a parte.
   Uso: npm test (oppure node test/valoreProgetti.test.mjs).
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti».
   ========================================================================= */
import assert from "node:assert/strict";
import { valoreProgettoCaso, valoreProgetti, costiPerCaso } from "../src/lib/crediti/simulatore.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

prova("Caso 1 a 16.735 abitanti: rata annua delle tabelle × 10 anni", () => {
  const annuo = costiPerCaso("caso1", 16735).reduce((s, c) => s + c.importo, 0);
  const v = valoreProgettoCaso("caso1", 16735, "10 anni");
  assert.equal(v.annuo, Math.round(annuo * 100) / 100);
  assert.equal(v.totale, Math.round(v.annuo * 10 * 100) / 100);
  assert.equal(v.anni, 10);
  assert.equal(v.stima, false);
  // Valore noto del rilievo N01: 16.232,95 €/anno.
  assert.equal(v.annuo, 16232.95);
});

prova("Caso 2 più caro del Caso 1; 7 anni rinnovabili = stima su 7 anni", () => {
  const c1 = valoreProgettoCaso("caso1", 20000);
  const c2 = valoreProgettoCaso("caso2", 20000);
  assert.ok(c2.annuo > c1.annuo);
  const s = valoreProgettoCaso("caso2", 20000, "7 anni rinnovabili");
  assert.equal(s.anni, 7);
  assert.equal(s.stima, true);
  assert.equal(s.totale, Math.round(c2.annuo * 7 * 100) / 100);
});

prova("dati mancanti: niente valore", () => {
  assert.equal(valoreProgettoCaso(null, 10000), null);
  assert.equal(valoreProgettoCaso("caso3", 10000), null);
  assert.equal(valoreProgettoCaso("caso1", null), null);
  assert.equal(valoreProgettoCaso("caso1", 0), null);
});

prova("totale dei Progetti con quelli da indicare e senza popolazione", () => {
  const t = valoreProgetti([
    { caso: "caso1", popolazione: 16735, periodo: "10 anni" },
    { caso: "caso2", popolazione: 5000, periodo: "7 anni rinnovabili" },
    { caso: null, popolazione: 8000, periodo: "10 anni" },
    { caso: "caso1", popolazione: null, periodo: "10 anni" },
  ]);
  const a = valoreProgettoCaso("caso1", 16735);
  const b = valoreProgettoCaso("caso2", 5000, "7 anni rinnovabili");
  assert.deepEqual({ ...t, euro: undefined, annuo: undefined }, { progetti: 4, valorizzati: 2, euro: undefined, annuo: undefined, daIndicare: 1, senzaPopolazione: 1, stime: 1 });
  assert.equal(t.euro, Math.round((a.totale + b.totale) * 100) / 100);
  assert.equal(t.annuo, Math.round((a.annuo + b.annuo) * 100) / 100);
  assert.deepEqual(valoreProgetti([]), { progetti: 0, valorizzati: 0, euro: 0, annuo: 0, daIndicare: 0, senzaPopolazione: 0, stime: 0 });
});

console.log(`\n${n} prove superate (valore dei progetti).`);
