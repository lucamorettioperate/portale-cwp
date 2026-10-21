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
const datiScenario = { annoBase: { ...annoBase, cluster: 4 }, attuale: { anno: 2025, popolazione: 10000, proCapite: 380, seccoProCapite: 130 }, bufferPct: 20, metodoStima: "territorio", anni, economia: { ...economia, costoVerificaAnnua: "1500,50" } };
const scenario = { nome: "Obiettivo 2036", comune: "Comune di Prova/Test", durata: 10, anno_inizio: 2027, note: "Porta a porta & tariffa puntuale", dati: datiScenario };
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
await prova("file Excel valido con cinque fogli e numeri veri", async () => {
  const dati = await creaXlsxSimulazione(c, "uint8array");
  const zip = await JSZip.loadAsync(dati);
  const wb = await zip.file("xl/workbook.xml").async("string");
  for (const f of ["Sintesi", "Dati inseriti", "Anni", "Economia", "Costi"]) assert.ok(wb.includes(`name="${f}"`), f);
  const anniXml = await zip.file("xl/worksheets/sheet3.xml").async("string");
  assert.ok(anniXml.includes('<c r="A4" s="3"><v>2027</v></c>'));
  const sintesiXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
  assert.ok(sintesiXml.includes("Porta a porta &amp; tariffa puntuale"));
});
// Richiesta di Luca del 21/10/2026: nel report tutti i dati della pagina,
// con costi e grafici.
await prova("il report riprende tutti i dati inseriti nella pagina", () => {
  assert.ok(c.impostazioni.some(([k, v]) => k === "Buffer previsto" && v === "20%"));
  assert.ok(c.impostazioni.some(([k]) => k.startsWith("Utenze monitorate")));
  assert.ok(c.buffer.voci.length >= 1);
  assert.ok(c.riferimento.scheda.some(([k, v]) => k === "Anno di riferimento" && v === "2019"));
  assert.ok(c.riferimento.scheda.some(([k, v]) => k.startsWith("Cluster") && v.startsWith("4 ·")));
  const organico = c.riferimento.rifiuti.righe.find(([k]) => k === "Frazione organica");
  assert.equal(organico[1], 1300);
  assert.equal(organico[2], 130);
  assert.equal(c.riferimento.rifiuti.totale[1], 4000);
  assert.ok(c.attuale.some(([k, v]) => k === "Raccolta differenziata attuale" && Math.abs(v - ((380 - 130) / 380) * 100) < 1e-9));
  assert.equal(c.obiettivi.righe.length, 10);
  assert.equal(c.obiettivi.righe[0][2], 3900);
  // Parametri economici come nella pagina (virgola decimale accettata).
  const conCosti = contenutoSimulazione({ scenario, risultato, eco, economia: datiScenario.economia, popolazione: 10000 });
  assert.ok(conCosti.parametriEconomici.some(([k, v]) => k === "Ente di verifica, ogni anno" && v === 1500.5));
  assert.ok(conCosti.parametriEconomici.some(([k, v]) => k === "Valore proposto del credito" && v === 32));
  assert.equal(c.costi.totale[3], c.costi.righe.reduce((s, r) => s + r[3], 0));
});
await prova("risultati con la riga del totale e grafici pronti", () => {
  assert.equal(c.anni.colonne.length, c.anni.totali.length);
  assert.equal(c.anni.totali[c.anni.colonne.indexOf("Crediti netti (tCO2eq)")], risultato.totali.netti);
  assert.deepEqual(c.grafici.map((g) => g.titolo), ["Crediti netti stimati per anno (tCO2eq)", "Raccolta differenziata (%)", "Margine netto per anno (€)", "Margine cumulato (€)"]);
  assert.equal(c.grafici[0].valori.length, 10);
  assert.equal(c.grafici[1].soglia, 65);
  assert.ok(c.spiegazione.includes("1 t in meno"));
  const s = contenutoSimulazione({ scenario: { ...scenario, dati: { ...datiScenario, attuale: {} } }, risultato, eco: null, economia: {}, popolazione: 10000 });
  assert.equal(s.attuale, null);
  assert.equal(s.parametriEconomici, null);
  assert.equal(s.grafici.length, 2);
});
await prova("nome del file senza caratteri pericolosi", () => {
  assert.equal(nomeFileSimulazione(scenario, "xlsx"), "Simulazione_Comune_di_Prova_Test_Obiettivo_2036.xlsx");
});
console.log(`${n} prove superate`);
