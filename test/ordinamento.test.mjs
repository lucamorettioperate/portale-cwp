/* =========================================================================
   ordinamento.test.mjs — prove dell'ordinamento di tabelle ed elenchi
   (src/lib/ordinamento.js, usato da src/components/Ordinamento.jsx).
   Uso: npm test (oppure node test/ordinamento.test.mjs).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import assert from "node:assert/strict";
import { ordina } from "../src/lib/ordinamento.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };
const righe = [
  { codice: "CWP-2026-0010", org: "comune di Vvoli", crediti: 1200, data: "2026-10-18", attivo: true },
  { codice: "CWP-2026-0002", org: "Comune di Bovisio", crediti: null, data: "2026-09-01", attivo: false },
  { codice: "CWP-2026-0001", org: "Comune di Borgoval", crediti: 35.5, data: "", attivo: true },
];
const colonne = { codice: (r) => r.codice, org: (r) => r.org, crediti: (r) => r.crediti, data: (r) => r.data, attivo: (r) => r.attivo };
const codici = (x) => x.map((r) => r.codice.slice(-2));

prova("senza scelta l'ordine resta quello di partenza", () => {
  assert.deepEqual(codici(ordina(righe, colonne, { chiave: null })), ["10", "02", "01"]);
});
prova("testi in ordine naturale e senza distinguere maiuscole", () => {
  assert.deepEqual(codici(ordina(righe, colonne, { chiave: "codice", verso: "asc" })), ["01", "02", "10"]);
  assert.deepEqual(codici(ordina(righe, colonne, { chiave: "org", verso: "asc" })), ["01", "02", "10"]);
  assert.deepEqual(codici(ordina(righe, colonne, { chiave: "org", verso: "desc" })), ["10", "02", "01"]);
});
prova("numeri come numeri e vuoti sempre in fondo", () => {
  assert.deepEqual(codici(ordina(righe, colonne, { chiave: "crediti", verso: "asc" })), ["01", "10", "02"]);
  assert.deepEqual(codici(ordina(righe, colonne, { chiave: "crediti", verso: "desc" })), ["10", "01", "02"]);
});
prova("date ISO e booleani", () => {
  assert.deepEqual(codici(ordina(righe, colonne, { chiave: "data", verso: "desc" })), ["10", "02", "01"]);
  assert.deepEqual(codici(ordina(righe, colonne, { chiave: "attivo", verso: "asc" })), ["02", "10", "01"]);
});
console.log(`${n} prove superate`);
