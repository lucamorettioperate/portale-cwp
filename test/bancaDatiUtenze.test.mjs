/* =========================================================================
   bancaDatiUtenze.test.mjs — prove della Banca Dati Utenze per utenza
   (src/lib/crediti/bancaDatiUtenze.js, richieste di Luca del 22/10/2026).
   - file di prova con 20 utenze domestiche e 20 non domestiche
     (test/dati/Banca_dati_utenze_prova_40.xlsx, da
     strumenti/genera_utenze_casuali.py): letto tutto, categorie di
     simulazione proposte, avvisi per totale diverso e categorie mancanti;
   - righe sbagliate: il file non si carica e ogni errore dice foglio e riga;
   - codice doppio tra i due fogli, svuotamenti senza kg, numeri con la
     virgola, categoria numerica di Excel, colonna obbligatoria mancante;
   - controllo del modulo (controllaUtenza).
   Uso: npm test (oppure node test/bancaDatiUtenze.test.mjs).
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti».
   ========================================================================= */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leggiBancaDati, interpretaBancaDati, controllaUtenza, FRAZIONI_BDU } from "../src/lib/crediti/bancaDatiUtenze.js";
import { riassuntoUtenze } from "../src/lib/auditDettaglio.js";

let n = 0;
const prova = async (nome, f) => { await f(); n++; console.log("✓", nome); };

const intestUd = ["Codice utenza", "Nome capofamiglia", "Indirizzo", "Categoria tariffaria", "N. componenti", "Mq abitazione", "Produzione totale (kg)",
  ...FRAZIONI_BDU.map(([, nome]) => `${nome} (kg)`), ...FRAZIONI_BDU.map(([, nome]) => `Svuotamenti ${nome === "RAEE" ? nome : nome.toLowerCase()}`)];
const intestUnd = ["Codice utenza", "Ragione sociale", "Indirizzo", "Categoria tariffaria", "Mq locali", "Produzione totale (kg)",
  ...intestUd.slice(7)];
// Riga con kg di indifferenziato e organico e svuotamenti dell'indifferenziato.
const rigaUd = (codice, extra = {}) => {
  const r = [codice, "Mario Rossi", "Via Roma 1", 3, 3, 90, 300, 120, 180];
  r[7 + 12] = 26;
  return Object.assign(r, extra);
};

await prova("file di prova: 20 + 20 utenze, categorie proposte, avvisi", async () => {
  const r = await leggiBancaDati(readFileSync(new URL("./dati/Banca_dati_utenze_prova_40.xlsx", import.meta.url)), "prova.xlsx");
  assert.deepEqual(r.errori, []);
  assert.deepEqual(r.conteggi, { UD: 20, UnD: 20, senzaCategoria: 4 });
  assert.equal(r.utenze.length, 40);
  const u1 = r.utenze[0];
  assert.equal(u1.codice, "PROVA-UD-001");
  assert.equal(u1.categoria_simulazione, u1.categoria_tariffaria);
  assert.ok(u1.frazioni.indifferenziato.kg >= 0);
  assert.ok(r.utenze.filter((u) => u.tipo === "UnD").every((u) => u.componenti === null));
  assert.ok(r.avvisi.some((a) => a.includes("PROVA-UD-005") && a.includes("diversa dalla somma")));
  assert.ok(r.avvisi.some((a) => a.startsWith("4 utenze senza categoria")));
});

await prova("righe sbagliate: file non caricato, foglio e riga nel messaggio", () => {
  const fogli = {
    Utenze_domestiche: [
      intestUd,
      rigaUd("A1"),
      rigaUd("A2", { 7: null }),               // manca l'indifferenziato
      rigaUd("A3", { 4: 2.5 }),                // componenti decimali
      rigaUd("A4", { 8: -5 }),                 // kg negativi
      rigaUd("A5", { 1: "" }),                 // manca il capofamiglia
    ],
  };
  const r = interpretaBancaDati(fogli);
  assert.equal(r.utenze.length, 0);
  assert.equal(r.errori.length, 4);
  assert.match(r.errori[0], /Utenze_domestiche, riga 3 \(A2\):.*mancano i kg di indifferenziato/);
  assert.match(r.errori[1], /riga 4 \(A3\): componenti «2.5»/);
  assert.match(r.errori[2], /riga 5 \(A4\): kg di organico non validi/);
  assert.match(r.errori[3], /riga 6 \(A5\): manca il nome del capofamiglia/);
});

await prova("codice doppio tra i fogli, svuotamenti senza kg, virgola, categoria numerica", () => {
  const und = [ "A1", "Bar Sport", "Piazza 1", 24, 80, "1.200,5", "400,5" ];
  und[6 + 2] = 800; // organico
  const fogli = {
    Utenze_domestiche: [intestUd, rigaUd("A1"), rigaUd("B2", { 8: null, 20: 40 })],
    Utenze_non_domestiche: [intestUnd, und],
  };
  const r = interpretaBancaDati(fogli);
  assert.ok(r.errori.some((e) => /riga 3 \(B2\): svuotamenti di organico senza i kg/.test(e)));
  assert.ok(r.errori.some((e) => /Utenze_non_domestiche, riga 2 \(A1\): codice A1 già usato alla riga 2 di Utenze_domestiche/.test(e)));
  // Senza il doppione la riga non domestica è valida: virgola e categoria numerica.
  und[0] = "N1";
  const r2 = interpretaBancaDati({ Utenze_non_domestiche: [intestUnd, und] });
  assert.deepEqual(r2.errori, []);
  assert.equal(r2.utenze[0].produzione_totale_kg, 1200.5);
  assert.equal(r2.utenze[0].frazioni.indifferenziato.kg, 400.5);
  assert.equal(r2.utenze[0].categoria_tariffaria, "24");
});

await prova("colonna obbligatoria mancante e file vuoto", () => {
  const r = interpretaBancaDati({ Utenze_domestiche: [intestUd.filter((h) => h !== "Indirizzo"), rigaUd("A1")] });
  assert.match(r.errori[0], /mancano le colonne Indirizzo/);
  const v = interpretaBancaDati({ Utenze_domestiche: [intestUd] });
  assert.match(v.errori[0], /non contiene utenze/);
});

await prova("modulo: componenti su non domestica, totale diverso, senza categoria", () => {
  const base = { codice: "X", nominativo: "Ditta", indirizzo: "Via 1", produzione_totale_kg: 100, frazioni: { indifferenziato: { kg: 100 } } };
  assert.ok(controllaUtenza({ ...base, tipo: "UnD", componenti: 2 }).errori.some((e) => /solo per le utenze domestiche/.test(e)));
  const a = controllaUtenza({ ...base, tipo: "UD", produzione_totale_kg: 150 });
  assert.deepEqual(a.errori, []);
  assert.ok(a.avvisi.some((x) => /diversa dalla somma/.test(x)));
  assert.ok(a.avvisi.some((x) => /senza categoria/.test(x)));
  assert.deepEqual(controllaUtenza({ ...base, tipo: "UD", categoria_simulazione: "2" }).avvisi, []);
  assert.ok(controllaUtenza({ ...base, tipo: "UD", frazioni: { indifferenziato: { kg: 10, svuotamenti: 1.5 } } }).errori.some((e) => /svuotamenti/.test(e)));
});

await prova("audit: riassunto degli eventi delle utenze", () => {
  assert.equal(riassuntoUtenze({ operazione: "modifica utenza", dettaglio: { codice: "PROVA-UD-008", tipo: "UD", campi: ["categoria_simulazione", "categoria_tariffaria"] } }),
    "utenza PROVA-UD-008 (domestica) · campi: categoria simulazione, categoria tariffaria");
  assert.equal(riassuntoUtenze({ operazione: "caricamento utenze", dettaglio: { utenze: 40, domestiche: 20, non_domestiche: 20 } }), "40 utenze (20 domestiche, 20 non domestiche)");
  assert.equal(riassuntoUtenze({ operazione: "consultazione utenze", dettaglio: { ricerca: "rossi" } }), "ricerca «rossi»");
  assert.equal(riassuntoUtenze({ operazione: "apertura fase", dettaglio: { codice: "x" } }), null);
});

console.log(`\n${n} prove superate (Banca Dati Utenze).`);
