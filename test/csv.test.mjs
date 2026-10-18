// =========================================================================
// csv.test.mjs — test del lettore e scrittore CSV (src/lib/csv.js).
//
// Scopo: verifica che i CSV salvati da Excel in italiano (BOM, separatore
// ";", virgola decimale, punto delle migliaia, testi tra virgolette con ";"
// dentro, righe vuote) siano letti correttamente; che intestazioni con
// maiuscole/accenti diversi e separatore "," siano riconosciute; che le
// colonne obbligatorie mancanti siano segnalate; che scrittura e rilettura
// diano gli stessi valori.
//
// Usato da: npm test (package.json, script "test").
// Dati/servizi coinvolti: nessuno.
//
// Uso: node test/csv.test.mjs   (oppure npm test per tutti i test)
// Esito: stampa "CSV: tutte le verifiche superate."; altrimenti AssertionError.
//
// Registro sviluppo e deploy: capitolo 8 «Procedure di rilascio»;
// capitolo 6 «Portale (frontend)» (test/).
// =========================================================================
import assert from "node:assert/strict";
import { leggiCsv, csvInOggetti, scriviCsv } from "../src/lib/csv.js";

// File in stile Excel italiano: BOM, ";" e virgola decimale, virgolette, riga vuota finale.
const testo = "﻿Codice EER;Descrizione;Tipologia;Quantità (t/anno);Solo domestiche\r\n" +
  "200301;\"Rifiuti urbani; non differenziati\";indifferenziato;1.250,4;no\r\n" +
  "200201;Verde;verde;210;sì\r\n" +
  "200108;Organico;organico;abc;no\r\n\r\n";
const schema = [
  { chiave: "codice", titoli: ["Codice EER"] },
  { chiave: "descrizione", titoli: ["Descrizione"] },
  { chiave: "tipologia", titoli: ["Tipologia"], obbligatorio: true },
  { chiave: "qtot", titoli: ["Quantità (t/anno)", "quantita"], tipo: "numero", obbligatorio: true },
  { chiave: "soloDomestiche", titoli: ["Solo domestiche"], tipo: "si_no" },
];
const esito = csvInOggetti(testo, schema);
assert.equal(esito.righe.length, 2);
assert.equal(esito.righe[0].descrizione, "Rifiuti urbani; non differenziati");
assert.equal(esito.righe[0].qtot, 1250.4);
assert.equal(esito.righe[1].soloDomestiche, true);
assert.equal(esito.erroriTotali, 1); // "abc" non è un numero

// Intestazioni con maiuscole/accenti diversi e separatore ","
const e2 = csvInOggetti("tipologia,QUANTITA\norganico,12.5\n", schema);
assert.equal(e2.righe[0].qtot, 12.5);

// Colonna obbligatoria mancante
assert.deepEqual(csvInOggetti("Descrizione\nx\n", schema).colonneMancanti, ["Tipologia", "Quantità (t/anno)"]);

// Andata e ritorno: il numero 1.5 torna come testo "1,5" (virgola decimale),
// la cella con ";" torna intera grazie alle virgolette.
const out = scriviCsv(["A", "B"], [["x;y", 1.5]]);
assert.deepEqual(leggiCsv(out), [["A", "B"], ["x;y", "1,5"]]);
console.log("CSV: tutte le verifiche superate.");
