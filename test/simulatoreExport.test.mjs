/* =========================================================================
   simulatoreExport.test.mjs — prove di stampa ed export Excel del simulatore
   (src/lib/crediti/simulatoreExport.js, usato da src/pages/Simulatore.jsx).
   Scopo: verificare che le tabelle preparate per PDF ed Excel riprendano
   i risultati del simulatore (sintesi, anni, economia, costi del Caso 1),
   che il file .xlsx sia un archivio valido con i fogli attesi e numeri
   veri nelle celle, e che il nome del file sia sicuro.
   Uso: npm test (oppure node test/simulatoreExport.test.mjs).
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti», backlog 37.
   ========================================================================= */
import assert from "node:assert/strict";
import JSZip from "jszip";
import { simula, simulaEconomia } from "../src/lib/crediti/simulatore.js";
import { contenutoSimulazione, creaXlsxSimulazione, nomeFileSimulazione } from "../src/lib/crediti/simulatoreExport.js";

let n = 0;
const prova = async (nome, f) => { await f(); n++; console.log("✓", nome); };

// Comune di prova: 10.000 abitanti, 10 anni di obiettivi in calo.
const annoBase = { metodo: "anno", anno: 2019, popolazione: 10000, rifiuti: { organico: 1300, carta: 750, vetro: 350, plastica: 200, indifferenziato: 1400 } };
const anni = Array.from({ length: 10 }, (_, i) => ({ anno: 2027 + i, popolazione: 10000, totale: 3900 - i * 30, seccoProCapite: 120 - i * 4 }));
const risultato = simula({ annoBase, anni, bufferPct: 20 });
const economia = { prezzo: 32, listino: "caso1" };
const eco = simulaEconomia(risultato.righe, economia, 10000);
const scenario = { nome: "Obiettivo 2036", comune: "Comune di Prova/Test", durata: 10, anno_inizio: 2027, note: "Porta a porta & tariffa puntuale" };
const c = contenutoSimulazione({ scenario, risultato, eco, economia, popolazione: 10000 });

await prova("sintesi e anni riprendono i totali del simulatore", () => {
  assert.equal(c.sintesi[0][1], risultato.totali.netti);
  assert.equal(c.anni.righe.length, 10);
  assert.equal(c.anni.righe[0][0], 2027);
  assert.equal(c.anni.colonne.length, c.anni.righe[0].length);
  assert.ok(c.scheda.some(([k, v]) => k === "Periodo" && v.includes("dal 2027 al 2036")));
});
await prova("economia con riga del totale e costi del Caso 1", () => {
  assert.equal(c.economia.righe.length, 10);
  assert.equal(c.economia.totali[9], eco.totali.margine);
  assert.equal(c.costi.righe.length, 6);
  assert.ok(c.costi.listino.startsWith("Caso 1"));
  assert.ok(c.sintesi.some(([k]) => k === "Margine nel periodo"));
});
await prova("senza economia niente tabelle economiche", () => {
  const s = contenutoSimulazione({ scenario, risultato, eco: null, economia: { listino: "nessuno" }, popolazione: 10000 });
  assert.equal(s.economia, null);
  assert.equal(s.costi, null);
});
await prova("file Excel valido con quattro fogli e numeri veri", async () => {
  const dati = await creaXlsxSimulazione(c, "uint8array");
  const zip = await JSZip.loadAsync(dati);
  const wb = await zip.file("xl/workbook.xml").async("string");
  for (const f of ["Sintesi", "Anni", "Economia", "Costi"]) assert.ok(wb.includes(`name="${f}"`), f);
  const anniXml = await zip.file("xl/worksheets/sheet2.xml").async("string");
  assert.ok(anniXml.includes('<c r="A4" s="3"><v>2027</v></c>'));
  const sintesiXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
  assert.ok(sintesiXml.includes("Porta a porta &amp; tariffa puntuale"));
});
await prova("nome del file senza caratteri pericolosi", () => {
  assert.equal(nomeFileSimulazione(scenario, "xlsx"), "Simulazione_Comune_di_Prova_Test_Obiettivo_2036.xlsx");
});
console.log(`${n} prove superate`);
