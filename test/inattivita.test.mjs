/* =========================================================================
   inattivita.test.mjs — prove dei tempi dell'uscita per inattività
   (src/lib/inattivita.js, usato da src/components/UscitaInattivita.jsx).
   Uso: npm test (oppure node test/inattivita.test.mjs).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import assert from "node:assert/strict";
import { msInattivita, AVVISO_MS } from "../src/lib/inattivita.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };
prova("staff: 30 minuti", () => {
  assert.equal(msInattivita("admin"), 30 * 60000);
  assert.equal(msInattivita("operatore"), 30 * 60000);
});
prova("enti e ruolo sconosciuto: 60 minuti", () => {
  assert.equal(msInattivita("cliente"), 60 * 60000);
  assert.equal(msInattivita(null), 60 * 60000);
});
prova("avviso 2 minuti prima, sempre prima dell'uscita", () => {
  assert.equal(AVVISO_MS, 120000);
  assert.ok(AVVISO_MS < msInattivita("admin"));
});
console.log(`${n} prove superate`);
