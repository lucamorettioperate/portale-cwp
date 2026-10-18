/* Test dell'import del tracciato dati CWP (src/lib/crediti/tracciato.js).
   File di prova generati da strumenti/genera_esempi_tracciato.py.
   Uso: node test/tracciato.test.mjs */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { leggiFileTracciato, controllaPrivacy, interpretaTracciato, controllaCoerenza } from "../src/lib/crediti/tracciato.js";
import { calcolaCrediti } from "../src/lib/crediti/calcolo.js";
import { TIPOLOGIE_RIFIUTO, BENI_RIUSO } from "../src/lib/crediti/parametri.js";

const dati = (n) => readFileSync(new URL(`./dati/${n}`, import.meta.url));
let ok = 0;
const prova = async (nome, fn) => { await fn(); ok++; console.log("✓", nome); };

await prova("Excel compilato: anagrafica, fogli e numeri", async () => {
  const { tipo, fogli } = await leggiFileTracciato(dati("tracciato_esempio.xlsx"), "tracciato_esempio.xlsx");
  assert.equal(tipo, "xlsx");
  assert.deepEqual(controllaPrivacy(fogli), []);
  const t = interpretaTracciato(fogli, 2025);
  assert.equal(t.anagrafica.anno, 2025);
  assert.equal(t.anagrafica.pefUd, 65);
  assert.equal(t.anagrafica.tariffaPuntuale, true);
  assert.equal(t.rifiuti.length, 4);
  assert.equal(t.rifiuti[0].codice, "200301");
  assert.equal(t.rifiuti[0].qtot, 1250.4);
  assert.equal(t.rifiuti[2].soloDomestiche, true);
  assert.equal(t.classiUd.length, 2);
  assert.equal(t.classiUnd[0].kd, 2.6);
  assert.equal(t.conferimenti.length, 4);
  assert.equal(t.conferimenti[3].macro, "UnD");
  assert.equal(t.conferimenti[2].pesoCdr, 12.5);
  assert.equal(t.riuso[0].bene, "maglione");
  assert.equal(t.scartiTotali, 0);
  assert.deepEqual(t.errori, []);
});

await prova("Dati personali: bloccati", async () => {
  const { fogli } = await leggiFileTracciato(dati("tracciato_privacy.xlsx"));
  const p = controllaPrivacy(fogli);
  assert.ok(p.some((x) => x.tipo === "codice fiscale"));
  assert.ok(p.some((x) => x.tipo === "indirizzo"));
  assert.ok(p.every((x) => !String(x.esempio).includes("80A01")), "i valori trovati sono oscurati");
});

await prova("ZIP di CSV con singole letture: aggregazione e anno", async () => {
  const { tipo, fogli } = await leggiFileTracciato(dati("tracciato_letture.zip"), "tracciato_letture.zip");
  assert.equal(tipo, "zip-csv");
  const t = interpretaTracciato(fogli, 2025);
  assert.equal(t.anagrafica.pefUnd, 35);
  const u1 = t.conferimenti.find((c) => c.utenza === "U0001");
  assert.equal(u1.svuotamenti, 18, "18 svuotamenti 2025 (quello del 2024 escluso)");
  assert.equal(u1.volume, 40);
  const u2 = t.conferimenti.find((c) => c.utenza === "U0002");
  assert.equal(u2.pesoCdr, 12.5);
  assert.equal(u2.svuotamenti, 1);
  assert.equal(t.conferimenti.find((c) => c.utenza === "N0042").pesoStrutture, 35);
  assert.ok(t.avvisi.some((a) => a.includes("fuori dall'anno 2025")));
});

await prova("Coerenza: dati corretti senza errori, dati sbagliati segnalati", async () => {
  const { fogli } = await leggiFileTracciato(dati("tracciato_esempio.xlsx"));
  const t = interpretaTracciato(fogli, 2025);
  const base = { anno: 2025, anagrafica: t.anagrafica, rifiuti: t.rifiuti, pefUd: 65, pefUnd: 35, classiUd: t.classiUd, classiUnd: t.classiUnd, conferimenti: t.conferimenti, riuso: t.riuso, ps: { indifferenziato: 80, organico: 250 } };
  const esiti = controllaCoerenza(base);
  assert.deepEqual(esiti.filter((e) => e.livello === "errore"), []);
  const sbagliati = controllaCoerenza({ ...base, anno: 2024, pefUnd: 30, conferimenti: [...t.conferimenti, { utenza: "U0009", macro: "UD", classe: "3 Componenti", tipologia: "indifferenziato", svuotamenti: 400, volume: 40 }] });
  const testi = sbagliati.map((e) => e.testo).join(" | ");
  assert.match(testi, /deve fare 100%/);
  assert.match(testi, /assenti nella delibera/);
  assert.match(testi, /più di 366 svuotamenti/);
  assert.match(testi, /diverso dall'anno del calcolo/);
});

await prova("Il calcolo gira sui dati importati", async () => {
  const { fogli } = await leggiFileTracciato(dati("tracciato_esempio.xlsx"));
  const t = interpretaTracciato(fogli, 2025);
  const r = calcolaCrediti({
    anno: 2025, tipo: "ex_post", rifiuti: t.rifiuti, pefUd: 65, pefUnd: 35, classiUd: t.classiUd, classiUnd: t.classiUnd,
    fattori: TIPOLOGIE_RIFIUTO, beni: BENI_RIUSO.map((x) => ({ id: x.id, peso: x.peso, fe: x.feRiutilizzo })),
    conferimenti: t.conferimenti, riuso: t.riuso, opzioni: {},
  });
  assert.ok(Number.isFinite(r.deltaI));
  assert.equal(r.utenze.dettaglio.length, 3);
});

console.log(`\n${ok} prove superate`);
