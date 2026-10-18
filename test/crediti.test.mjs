// =========================================================================
// crediti.test.mjs — test del motore di calcolo dei crediti.
//
// Scopo: verifica del motore di calcolo con un esempio calcolato a mano
// (un piccolo Comune con 2 classi domestiche e 1 non domestica). Controlla
// le formule 1-17, 19-22 e 28-32 (non la 18: peso specifico a consuntivo),
// i buffer delle Tabelle 15-16 e la doppia
// interpretazione del riuso (formula 29 come scritta / riuso come credito).
// I valori attesi sono scritti nei commenti accanto a ogni controllo.
//
// Usato da: npm test (package.json, script "test").
// Dati/servizi coinvolti: nessuno; importa src/lib/crediti/calcolo.js e
// parametri.js. Nessun accesso a Supabase.
//
// Uso: node test/crediti.test.mjs   (oppure npm test per tutti i test)
// Esito: stampa "Tutte le verifiche superate." e alcuni valori; al primo
// controllo fallito si ferma con un errore AssertionError.
// Se si cambia una formula o un default di parametri.js, aggiornare qui i
// valori attesi E spiegare il perché nel Registro.
//
// Registro sviluppo e deploy: capitolo 8 «Procedure di rilascio» (npm test
// prima di ogni rilascio); capitolo 15 «Calcolo crediti».
// =========================================================================
import assert from "node:assert/strict";
import { calcolaCrediti, produzioneAttesa, fattoreIndifferenziato, coefficientePrimoAnno, calcolaBuffer } from "../src/lib/crediti/calcolo.js";
import { TIPOLOGIE_RIFIUTO, BENI_RIUSO } from "../src/lib/crediti/parametri.js";

// Confronto tra numeri decimali con tolleranza (evita errori di arrotondamento).
const vicino = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// --- Esempio: comune con 2 classi domestiche e 1 non domestica ---
// Rifiuti (t/anno): indifferenziato 100, organico 60, carta 40, verde 20 (solo domestico)
const rifiuti = [
  { codice: "200301", tipologia: "indifferenziato", qtot: 100 },
  { codice: "200108", tipologia: "organico", qtot: 60 },
  { codice: "200101", tipologia: "carta", qtot: 40 },
  { codice: "200201", tipologia: "verde", qtot: 20, soloDomestiche: true },
];
// PEF: 70% domestiche, 30% non domestiche
// Qtot = 220; QUD = 154; QUnD = 66; QUDes = 20
// P%UnD = 66 / (154 + 66 - 20) = 66/200 = 0.33 ; P%UD = 0.67
const classiUd = [
  { classe: "1 comp", n: 100, kb: 0.6 },
  { classe: "2 comp", n: 50, kb: 1.4 },
];
// ΣN×Kb = 60 + 70 = 130 ; Q%UD(1) = 60/130 ; Q%UD(2) = 70/130
const classiUnd = [{ classe: "cat 1", n: 10, superficie: 1000, kd: 4 }];
// unica classe: Q%UnD = 1

const pa = produzioneAttesa({ rifiuti, pefUd: 70, pefUnd: 30, classiUd, classiUnd });
vicino(pa.Qtot, 220);
vicino(pa.pUnD, 0.33);
vicino(pa.pUd, 0.67);
// indifferenziato: QUD = 0.67×100 = 67 t ; PAUD(1 comp) = 67×1000×(60/130)/100 = 309.2307…
const c1 = pa.classi.find((c) => c.classe === "1 comp");
vicino(c1.atteso.indifferenziato, (67 * 1000 * (60 / 130)) / 100);
// verde solo domestico: QUD = 20 ; PAUD(2 comp) = 20×1000×(70/130)/50
const c2 = pa.classi.find((c) => c.classe === "2 comp");
vicino(c2.atteso.verde, (20 * 1000 * (70 / 130)) / 50);
// non domestica: indifferenziato QUnD = 33 t ; PAUnD = 33×1000×1/10 = 3300 kg
const nd = pa.classi.find((c) => c.macro === "UnD");
vicino(nd.atteso.indifferenziato, 3300);
vicino(nd.atteso.verde, 0);

// --- Formule 16-17: FE indifferenziato = media pesata delle frazioni a recupero ---
const fattori = Object.fromEntries(TIPOLOGIE_RIFIUTO.map((t) => [t.id, t]));
const fi = fattoreIndifferenziato({ indifferenziato: 100, organico: 60, carta: 40, verde: 20 }, fattori);
// (-3.66×60 + -6.07×40 + -0.76×20) / 120
vicino(fi.fe, (-3.66 * 60 + -6.07 * 40 + -0.76 * 20) / 120);

// --- Formula 1: primo anno parziale ---
const pa1 = coefficientePrimoAnno("2026-07-01", 2026);
assert.equal(pa1.giorni, 184);
vicino(pa1.coefficiente, 184 / 365);

// --- Buffer: esempio della Metodologia (indiff + organico + vetro + Centro di Raccolta = 13%) ---
const b = calcolaBuffer({
  utenzeMonitorate: { res: true, nonres: true, und: true },
  rifiutiMisurati: { indifferenziato: true, organico: true, vetro: true },
  misuraCentralizzate: true,
});
vicino(b.totale, 13);
// Caso massimo: solo virtuose (20) + solo non residenti (30) + solo indifferenziato (30) = 80
const bmax = calcolaBuffer({ soloVirtuose: true, bufferVirtuose: 20, utenzeMonitorate: { nonres: true }, rifiutiMisurati: { indifferenziato: true } });
vicino(bmax.totale, 80);

// --- Calcolo completo ex post con due utenze e PS da Tabella 8 ---
// Utenza A (1 comp): 20 svuotamenti × 40 L di indifferenziato → 800 L × 80 kg/m³ / 1000 = 64 kg
// Utenza B (1 comp): 60 svuotamenti × 40 L → 2400 L → 192 kg
// Atteso indifferenziato per utenza 1 comp = 309.23 kg
const feInd = fi.fe;
const risultato = calcolaCrediti({
  anno: 2026,
  tipo: "ex_post",
  rifiuti,
  pefUd: 70,
  pefUnd: 30,
  classiUd,
  classiUnd,
  fattori: TIPOLOGIE_RIFIUTO,
  beni: BENI_RIUSO.map((x) => ({ id: x.id, peso: x.peso, fe: x.feRiutilizzo })),
  conferimenti: [
    { utenza: "A", macro: "UD", classe: "1 comp", tipologia: "indifferenziato", svuotamenti: 20, volume: 40 },
    { utenza: "B", macro: "UD", classe: "1 comp", tipologia: "indifferenziato", svuotamenti: 60, volume: 40 },
  ],
  opzioni: { utenzeMonitorate: { res: true }, rifiutiMisurati: { indifferenziato: true } },
});
const attesoKg = (67 * 1000 * (60 / 130)) / 100;
const A = risultato.utenze.dettaglio.find((u) => u.utenza === "A");
vicino(A.ptot.indifferenziato, 64);
// EA(A) = -309.23 × FE ; EP(A) = -64 × FE ; ΔI = (attesoKg - 64) × FE  (FE negativo → ΔI negativo = credito)
vicino(A.ea, -attesoKg * feInd);
vicino(A.ep, -64 * feInd);
vicino(A.deltaI, -64 * feInd + attesoKg * feInd);
const B = risultato.utenze.dettaglio.find((u) => u.utenza === "B");
vicino(B.deltaI, -192 * feInd + attesoKg * feInd);
// ΔI territorio = somma ; crediti lordi = -ΔI/1000
const dI = (attesoKg * 2 - 64 - 192) * feInd;
vicino(risultato.deltaI, dI);
vicino(risultato.crediti.lordi, -dI / 1000);
// buffer: res (15) + solo indiff (30) = 45%
vicino(risultato.buffer.totale, 45);
vicino(risultato.crediti.netti, (-dI / 1000) * 0.55);

console.log("Tutte le verifiche superate.");
console.log("FE indifferenziato:", feInd.toFixed(4), "kgCO2eq/kg");
console.log("Atteso indifferenziato utenza 1 comp:", attesoKg.toFixed(2), "kg");
console.log("ΔI territorio:", risultato.deltaI.toFixed(2), "kgCO2eq");
console.log("Crediti lordi / netti:", risultato.crediti.lordi.toFixed(4), "/", risultato.crediti.netti.toFixed(4), "tCO2eq");
console.log("Avvisi:", risultato.avvisi);

// Riuso: formula 29 come scritta (aumenta EP) e opzione come credito.
const base = {
  anno: 2026, tipo: "ex_post", rifiuti, pefUd: 70, pefUnd: 30, classiUd, classiUnd,
  fattori: TIPOLOGIE_RIFIUTO,
  beni: [{ id: "maglione", peso: 0.5, fe: -9.22 }],
  conferimenti: [{ utenza: "A", macro: "UD", classe: "1 comp", tipologia: "indifferenziato", svuotamenti: 20, volume: 40 }],
  riuso: [{ utenza: "A", macro: "UD", classe: "1 comp", bene: "maglione", pezzi: 4 }],
};
const comeScritta = calcolaCrediti({ ...base, opzioni: {} }).utenze.dettaglio[0];
const comeCredito = calcolaCrediti({ ...base, opzioni: { riusoComeCredito: true } }).utenze.dettaglio[0];
// 4 maglioni × 0,5 kg = 2 kg ; 2 × 9,22 = 18,44 kgCO2eq
vicino(comeScritta.ep - comeCredito.ep, 2 * 18.44);
console.log("Riuso: formula come scritta +18,44 kgCO2eq / come credito −18,44 kgCO2eq — verificato.");
