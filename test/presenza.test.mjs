/* =========================================================================
   presenza.test.mjs — prove dei testi del pannello «Utenti online»
   (src/lib/presenza.js, usato da src/components/UtentiOnline.jsx).
   Uso: npm test (oppure node test/presenza.test.mjs).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import assert from "node:assert/strict";
import { durata, nomePagina } from "../src/lib/presenza.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

prova("nomi delle pagine del menu", () => {
  assert.equal(nomePagina("/pratiche"), "Pratiche");
  assert.equal(nomePagina("/"), "Dashboard / Le mie pratiche");
  assert.equal(nomePagina("/pratiche?id=123"), "Pratiche");
});
prova("sottopagine e indirizzi sconosciuti", () => {
  assert.equal(nomePagina("/crediti/abc"), "Calcolo crediti");
  assert.equal(nomePagina("/crediti-emessi"), "Crediti emessi");
  assert.equal(nomePagina("/sconosciuta"), "/sconosciuta");
  assert.equal(nomePagina("/audit-utenti"), "Audit User");
  assert.equal(nomePagina(null), "—");
});
prova("durate leggibili", () => {
  const ora = Date.parse("2026-10-20T12:00:00Z");
  assert.equal(durata("2026-10-20T11:59:40Z", ora), "meno di un minuto");
  assert.equal(durata("2026-10-20T11:48:00Z", ora), "12 min");
  assert.equal(durata("2026-10-20T10:00:00Z", ora), "2 h");
  assert.equal(durata("2026-10-20T09:55:00Z", ora), "2 h 5 min");
  assert.equal(durata("2026-10-20T12:05:00Z", ora), "meno di un minuto");
});
console.log(`${n} prove superate`);
