/* =========================================================================
   collaudo_v01.test.mjs — prove di regressione del collaudo V01
   (rapporto «Carbon WastePrint — criticità e consegna all'agente di
   correzione», V01 del 20/10/2026, collaudatori Andrea Valentini, Albina
   Ambrogio, Andrea Pavan, Gianluca Tapparini, Luca Belfiore).

   Scopo: una prova per ogni difetto corretto (D01-D07) con i valori
   esatti del rapporto, i casi limite chiesti nella «Verifica dopo la
   correzione» e i casi ordinari S e C, che devono restare identici
   (netto 292,8 tCO₂eq/anno; 0,2928 tCO₂eq). Le riserve metodologiche
   (R01, R02, R03, riuso) NON si chiudono qui: le prove R01/R02 fissano
   soltanto il comportamento attuale, in attesa della regola.
   Uso: npm test (oppure node test/collaudo_v01.test.mjs).
   Registro sviluppo e deploy: capitolo «Collaudo», script 35.
   ========================================================================= */
import assert from "node:assert/strict";
import { csvInOggetti, scriviCsv, testoSicuroCsv } from "../src/lib/csv.js";
import { data, controllaCoerenza, interpretaTracciato } from "../src/lib/crediti/tracciato.js";
import { calcolaCrediti, coefficientePrimoAnno, calcolaBuffer, valoriNonAmmessiBdu } from "../src/lib/crediti/calcolo.js";
import { TIPOLOGIE_RIFIUTO } from "../src/lib/crediti/parametri.js";
import { simula, simulaEconomia, erroriScenario, erroriEconomia, bufferMetodologia, quotaVirtuose, righeCsv } from "../src/lib/crediti/simulatore.js";
import { formatoData, giorniA, dataIsoEsiste } from "../src/lib/date.js";
import { modificheEvento, etichettaOggetto } from "../src/lib/auditDettaglio.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };
const vicino = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= Math.max(eps, Math.abs(b) * 1e-12), `${a} ≠ ${b}`);

/* ---------------- Dati del caso C (calcolo crediti) ----------------
   Territorio sintetico: 0,26 t organico + 0,14 t indifferenziato (RD 65%),
   una classe domestica UD1 con una utenza S001. Fattore organico −3,66;
   l'indifferenziato prende la media delle frazioni a recupero = −3,66.
   Atteso 400 kg × 3,66 = 1.464 kgCO₂eq; progetto 300 kg (225 + 75) ×
   3,66 = 1.098; ΔI = −366 kg; buffer 20% → netto 0,2928 tCO₂eq. */
const fattori = TIPOLOGIE_RIFIUTO.map((t) => ({ id: t.id, nome: t.nome, fe: t.fe, ps: t.ps, recupero: t.recupero, calcolato: !!t.calcolato }));
const datiC = {
  anno: 2025, tipo: "ex_post", dataAvvio: null,
  rifiuti: [
    { codice: "200108", tipologia: "organico", qtot: 0.26 },
    { codice: "200301", tipologia: "indifferenziato", qtot: 0.14 },
  ],
  pefUd: 100, pefUnd: 0,
  classiUd: [{ classe: "UD1", n: 1, kb: 1 }], classiUnd: [],
  fattori, beni: [],
  opzioni: { utenzeMonitorate: { res: true, nonres: true, und: true }, rifiutiMisurati: { indifferenziato: true, organico: true }, bufferManuale: "" },
};
const conferimentiC = [
  { utenza: "S001", macro: "UD", classe: "UD1", tipologia: "organico", pesoCdr: 225, nUtenze: 1 },
  { utenza: "S001", macro: "UD", classe: "UD1", tipologia: "indifferenziato", pesoCdr: 75, nUtenze: 1 },
];

prova("caso ordinario C invariato: netto 0,2928 tCO₂eq (buffer 20% calcolato e manuale)", () => {
  const r = calcolaCrediti({ ...datiC, conferimenti: conferimentiC, riuso: [] });
  assert.equal(r.bloccato, false);
  assert.deepEqual(r.errori, []);
  vicino(r.deltaI, -366, 1e-6);
  vicino(r.buffer.totale, 20);
  vicino(r.crediti.lordi, 0.366, 1e-12);
  vicino(r.crediti.netti, 0.2928, 1e-12);
  const m = calcolaCrediti({ ...datiC, opzioni: { ...datiC.opzioni, bufferManuale: "20" }, conferimenti: conferimentiC, riuso: [] });
  vicino(m.crediti.netti, 0.2928, 1e-12);
  // Variante del rapporto: RUR 90 kg → netto 0,24888
  const v = calcolaCrediti({ ...datiC, conferimenti: [conferimentiC[0], { ...conferimentiC[1], pesoCdr: 90 }], riuso: [] });
  vicino(v.crediti.netti, 0.24888, 1e-12);
});

/* ---------------- D07 — pesi negativi nella Banca Dati ---------------- */
const SCHEMA = [
  { chiave: "utenza", titoli: ["Utenza"], obbligatorio: true },
  { chiave: "macro", titoli: ["Macrocategoria"], obbligatorio: true },
  { chiave: "classe", titoli: ["Classe"], obbligatorio: true },
  { chiave: "tipologia", titoli: ["Tipologia rifiuto"], obbligatorio: true },
  { chiave: "svuotamenti", titoli: ["Svuotamenti"], tipo: "numero", min: 0 },
  { chiave: "pesoCdr", titoli: ["Peso centri di raccolta (kg)"], tipo: "numero", min: 0 },
];
prova("D07: il CSV del rapporto (organico −225) è rifiutato con riga e motivo", () => {
  const csv = "Utenza;Macrocategoria;Classe;Tipologia rifiuto;Peso centri di raccolta (kg)\nS001;UD;UD1;organico;-225\nS001;UD;UD1;indifferenziato;75";
  const e = csvInOggetti(csv, SCHEMA);
  assert.equal(e.righeScartate, 1);
  assert.match(e.errori[0], /Riga 2: «-225» non è ammesso .*negativo/);
});
prova("D07: zero e vuoto restano ammessi, negativi in ogni campo no", () => {
  const e = csvInOggetti("Utenza;Macrocategoria;Classe;Tipologia rifiuto;Svuotamenti;Peso centri di raccolta (kg)\nA;UD;UD1;organico;0;\nB;UD;UD1;organico;-1;5\nC;UD;UD1;organico;2;-0,5", SCHEMA);
  assert.equal(e.righe.length, 1);
  assert.equal(e.righeScartate, 2);
});
prova("D07: il motore non dà crediti con un peso negativo (bloccato)", () => {
  const neg = [{ ...conferimentiC[0], pesoCdr: -225 }, conferimentiC[1]];
  const r = calcolaCrediti({ ...datiC, conferimenti: neg, riuso: [] });
  assert.equal(r.bloccato, true);
  assert.equal(r.crediti.lordi, 0);
  assert.equal(r.crediti.netti, 0);
  assert.ok(r.errori[0].includes("valori negativi"));
});
prova("D07: tutti i campi della Banca Dati e del riuso sono controllati", () => {
  for (const k of ["svuotamenti", "volume", "pesoStrutture", "volumeStrutture", "pesoCdr", "volumeCdr", "nUtenze"]) {
    assert.equal(valoriNonAmmessiBdu({ conferimenti: [{ utenza: "X", [k]: -1 }] }).righe, 1, k);
  }
  for (const k of ["pezzi", "peso", "nUtenze"]) {
    assert.equal(valoriNonAmmessiBdu({ riuso: [{ utenza: "X", bene: "b", [k]: -1 }] }).righe, 1, k);
  }
  assert.equal(valoriNonAmmessiBdu({ conferimenti: [{ utenza: "X", pesoCdr: "abc" }] }).righe, 1);
  assert.equal(valoriNonAmmessiBdu({ conferimenti: conferimentiC }).righe, 0);
});
prova("D07: i controlli di coerenza segnalano un errore (blocca la conferma)", () => {
  const esiti = controllaCoerenza({ anno: 2025, rifiuti: datiC.rifiuti, pefUd: 100, pefUnd: 0, classiUd: datiC.classiUd, classiUnd: [], conferimenti: [{ ...conferimentiC[0], pesoCdr: -225 }], riuso: [] });
  assert.ok(esiti.some((e) => e.livello === "errore" && e.testo.includes("valori negativi")));
});

/* ---------------- R05 — conferma senza Banca Dati ---------------- */
prova("R05: senza Banca Dati Utenze i controlli danno un errore (conferma non disponibile)", () => {
  const esiti = controllaCoerenza({ anno: 2025, rifiuti: datiC.rifiuti, pefUd: 100, pefUnd: 0, classiUd: datiC.classiUd, classiUnd: [], conferimenti: [], riuso: [] });
  assert.ok(esiti.some((e) => e.livello === "errore" && e.testo.includes("Banca Dati Utenze")));
});

/* ---------------- D04 — date inesistenti ---------------- */
prova("D04: 31/02/2025 e 2025-02-31 non sono date; 29/02 solo nei bisestili", () => {
  assert.equal(data("31/02/2025"), null);
  assert.equal(data("2025-02-31"), null);
  assert.equal(data("13/13/2025"), null);
  assert.equal(data("29/02/2025"), null);
  assert.equal(data("29/02/2028").toISOString().slice(0, 10), "2028-02-29");
  assert.equal(data("31/12/2025").toISOString().slice(0, 10), "2025-12-31");
  assert.equal(data("01/01/2026").toISOString().slice(0, 10), "2026-01-01");
  assert.equal(data("2025-06-01").toISOString().slice(0, 10), "2025-06-01");
});
prova("D04: numeri seriali di Excel validi; fuori intervallo no", () => {
  assert.equal(data(45658).toISOString().slice(0, 10), "2025-01-01");
  assert.equal(data(46022).toISOString().slice(0, 10), "2025-12-31");
  assert.equal(data(0), null);
  assert.equal(data(-5), null);
});
prova("D04: primo anno con data inesistente = errore, non 304 giorni", () => {
  const c = coefficientePrimoAnno("2025-02-31", 2025);
  assert.equal(c.coefficiente, null);
  assert.match(c.errore, /non esiste/);
  assert.equal(coefficientePrimoAnno("2028-02-29", 2028).giorni, 307);
  assert.equal(coefficientePrimoAnno("2025-12-31", 2025).giorni, 1);
  assert.equal(coefficientePrimoAnno("2025-01-01", 2025).coefficiente, 1);
  const r = calcolaCrediti({ ...datiC, dataAvvio: "2025-02-31", conferimenti: conferimentiC, riuso: [] });
  assert.equal(r.bloccato, true);
  assert.equal(r.crediti.netti, 0);
});
prova("D04: formatoData e giorniA non spostano una data inesistente", () => {
  assert.equal(formatoData("2025-02-31"), "—");
  assert.equal(giorniA("2025-02-31"), null);
  assert.equal(formatoData("2028-02-29"), "29/02/2028");
  assert.equal(dataIsoEsiste("2027-02-29"), false);
});
prova("D04: lettura con data inesistente scartata con il motivo (ZIP del rapporto)", () => {
  // 6_Letture come nell'anteprima V03: 31/02/2025 organico 225 kg e
  // 01/06/2025 indifferenziato 75 kg, entrambe al centro di raccolta.
  const letture = [
    ["Utenza", "Macrocategoria", "Classe", "Tipologia rifiuto", "Data", "Punto di conferimento", "Volume contenitore (L)", "Peso (kg)"],
    ["S001", "UD", "UD1", "organico", "31/02/2025", "centro raccolta", "", "225"],
    ["S001", "UD", "UD1", "indifferenziato", "01/06/2025", "centro raccolta", "", "75"],
  ];
  const t = interpretaTracciato({ "6_Letture": letture }, 2025);
  assert.equal(t.conteggi.lettureUsate, 1);
  assert.ok(t.scarti.some((x) => x.includes("31/02/2025") && x.includes("non valida")));
  assert.equal(t.conferimenti.length, 1);
  assert.equal(t.conferimenti[0].tipologia, "indifferenziato");
});

/* ---------------- D02 — buffer oltre l'80% ---------------- */
// Scenario S del simulatore (rapporto, punto 4.1): riferimento 400 t (260
// organico + 140 RUR, RD 65%) per 1.000 abitanti; 2027 produzione 300 t
// (300 kg/ab) con secco 75 kg/ab. Atteso 1.464, progetto 1.098, lordi 366,
// buffer 73,2, netto 292,8.
const baseS = { metodo: "anno", anno: 2024, popolazione: 1000, rifiuti: { organico: 260, indifferenziato: 140 } };
const anniS = [{ anno: 2027, popolazione: "", totale: 300, seccoProCapite: 75 }];
prova("caso ordinario S invariato: netto 292,8 tCO₂eq/anno, 2.928 in dieci anni", () => {
  const r = simula({ annoBase: baseS, anni: anniS, bufferPct: 20 });
  assert.deepEqual(r.errori, []);
  vicino(r.righe[0].lordi, 366, 1e-9);
  vicino(r.righe[0].buffer, 73.2, 1e-9);
  vicino(r.righe[0].netti, 292.8, 1e-9);
  const dieci = Array.from({ length: 10 }, (_, i) => ({ ...anniS[0], anno: 2027 + i }));
  vicino(simula({ annoBase: baseS, anni: dieci, bufferPct: 20 }).totali.netti, 2928, 1e-6);
});
prova("D02: buffer 90 nel simulatore = errore e nessun risultato", () => {
  const r = simula({ annoBase: baseS, anni: anniS, bufferPct: 90 });
  assert.equal(r.righe.length, 0);
  assert.match(r.errori[0], /Buffer .*90 .*80/);
});
prova("D02: 0 e 80 ammessi; 80,01, 100, negativo, vuoto e testo no", () => {
  for (const v of [0, 80, "80", "0"]) assert.deepEqual(erroriScenario({ bufferPct: v }), [], String(v));
  for (const v of [80.01, 100, -1, "", "abc"]) assert.equal(erroriScenario({ bufferPct: v }).length, 1, String(v));
  // scenari salvati senza buffer: valore predefinito 20%, nessun errore
  assert.deepEqual(erroriScenario({}), []);
  assert.equal(simula({ annoBase: baseS, anni: anniS }).bufferPct, 20);
});
prova("D02: buffer indicato a mano nel calcolatore oltre 80 = errore bloccante", () => {
  const b = calcolaBuffer({ rifiutiMisurati: { indifferenziato: true, organico: true }, bufferManuale: 90 });
  assert.match(b.erroreManuale, /tra 0 e 80/);
  assert.equal(calcolaBuffer({ bufferManuale: 80 }).erroreManuale, null);
  const r = calcolaCrediti({ ...datiC, opzioni: { ...datiC.opzioni, bufferManuale: 90 }, conferimenti: conferimentiC, riuso: [] });
  assert.equal(r.bloccato, true);
  assert.equal(r.crediti.netti, 0);
});

/* ---------------- D01 — valori fisicamente impossibili ---------------- */
prova("D01: produzione −10 (pro capite), secco −10, popolazione −1000: nessun risultato", () => {
  for (const anno of [
    { anno: 2027, popolazione: "", totale: -10, seccoProCapite: 75 },
    { anno: 2027, popolazione: "", totale: 300, seccoProCapite: -10 },
    { anno: 2027, popolazione: -1000, totale: 300, seccoProCapite: 75 },
    { anno: 2027, popolazione: 0, totale: 300, seccoProCapite: 75 },
    { anno: 2027, popolazione: "", totale: 0, seccoProCapite: 75 },
  ]) {
    const r = simula({ annoBase: baseS, anni: [anno], bufferPct: 20 });
    assert.equal(r.righe.length, 0, JSON.stringify(anno));
    assert.ok(r.errori.length >= 1);
  }
  assert.ok(erroriScenario({ annoBase: { ...baseS, popolazione: -1000 } }).length >= 1);
  assert.ok(erroriScenario({ annoBase: { ...baseS, rifiuti: { organico: -5 } } }).length >= 1);
});
prova("D01: differenziata oltre il 100% impossibile (secco 0 ammesso)", () => {
  assert.ok(erroriScenario({ annoBase: baseS, anni: [{ anno: 2027, popolazione: "", totale: 300, seccoProCapite: 301 }] }).some((e) => e.includes("supera")));
  const r = simula({ annoBase: baseS, anni: [{ anno: 2027, popolazione: "", totale: 300, seccoProCapite: 0 }], bufferPct: 20 });
  vicino(r.righe[0].rd, 100);
  assert.ok(erroriScenario({ attuale: { proCapite: 300, seccoProCapite: 400 } }).length >= 1);
});

/* ---------------- D03 — prezzo zero ---------------- */
prova("D03: prezzo dell'anno 0 dà ricavi 0; vuoto eredita il prezzo generale", () => {
  const righe = [{ anno: 2027, netti: 100 }];
  assert.equal(simulaEconomia(righe, { prezzo: 32, prezzi: { 2027: 0 } }, 1000).righe[0].ricavi, 0);
  assert.equal(simulaEconomia(righe, { prezzo: 32, prezzi: { 2027: "0" } }, 1000).righe[0].ricavi, 0);
  assert.equal(simulaEconomia(righe, { prezzo: 32, prezzi: { 2027: "" } }, 1000).righe[0].ricavi, 3200);
  assert.equal(simulaEconomia(righe, { prezzo: 32, prezzi: {} }, 1000).righe[0].ricavi, 3200);
  assert.equal(simulaEconomia(righe, { prezzo: 32, prezzi: { 2027: 40 } }, 1000).righe[0].ricavi, 4000);
});
prova("D03: prezzo generale 0 valido; minimo 0 = scenario peggiore con ricavi 0", () => {
  const righe = [{ anno: 2027, netti: 100 }];
  assert.equal(simulaEconomia(righe, { prezzo: 0 }, 1000).totali.ricavi, 0);
  assert.equal(simulaEconomia(righe, { prezzo: "" }, 1000), null);
  assert.equal(simulaEconomia(righe, { prezzo: 32, prezzoMin: 0 }, 1000).totali.ricaviMin, 0);
  assert.equal(simulaEconomia(righe, { prezzo: 32, prezzoMin: "" }, 1000).totali.ricaviMin, null);
});
prova("D03: prezzi negativi o non numerici = errore, nessun risultato economico", () => {
  const righe = [{ anno: 2027, netti: 100 }];
  assert.equal(erroriEconomia({ prezzo: 32, prezzi: { 2027: -1 } }).length, 1);
  assert.equal(erroriEconomia({ prezzo: "abc" }).length, 1);
  assert.equal(erroriEconomia({ prezzo: 32, prezzoMin: 40, prezzoMax: 30 }).length, 1);
  assert.equal(simulaEconomia(righe, { prezzo: 32, prezzi: { 2027: -1 } }, 1000), null);
});

/* ---------------- R04 — pareggio esatto ---------------- */
prova("R04: pareggio esatto distinto dal primo saldo positivo (solo messaggio)", () => {
  const e = simulaEconomia([{ anno: 2027, netti: 10 }], { prezzo: 32, listino: "nessuno", altriCostiAnnui: 320 }, 1000);
  assert.equal(e.totali.margine, 0);
  assert.equal(e.totali.primoAnnoPositivo, null);
  assert.equal(e.totali.primoAnnoPareggio, 2027);
});

/* ---------------- D05 — audit leggibile ---------------- */
prova("D05: l'evento di modifica di uno scenario mostra nome, codice e cambi", () => {
  const ev = {
    oggetto_tipo: "scenario_simulazione", oggetto_id: "1234abcd-0000-0000-0000-000000000000",
    dettaglio: { dati: { da: { bufferPct: 20, anni: [{ anno: 2027, totale: 300 }] }, a: { bufferPct: "90", anni: [{ anno: 2027, totale: -10 }] } }, crediti_netti_totali: { da: 2928, a: 36.6 } },
  };
  assert.equal(etichettaOggetto(ev, { "1234abcd-0000-0000-0000-000000000000": "COLLAUDO S" }), "Scenario del simulatore «COLLAUDO S» (1234abcd)");
  const m = modificheEvento(ev);
  assert.deepEqual(m.map((x) => x.campo), ["Buffer (%)", "Anno 2027 › produzione totale (t)", "Crediti netti stimati (tCO₂eq)"]);
  assert.equal(m[1].da, 300);
  assert.equal(m[1].a, -10);
  // creazione: nessun elenco, ma il nome dal dettaglio
  assert.deepEqual(modificheEvento({ dettaglio: { nome: "Nuovo", dati: {} } }), []);
  assert.match(etichettaOggetto({ oggetto_tipo: "scenario_simulazione", oggetto_id: "abcdef12-x", dettaglio: { nome: "Nuovo" } }), /«Nuovo» \(abcdef12\)/);
});

/* ---------------- D06 — formule nei CSV ---------------- */
prova("D06: celle che iniziano con = + - @ diventano testo; numeri invariati", () => {
  const t = scriviCsv(["Nota"], [["=1+1"], ["+SUM(A1)"], ["@cmd"], ["-2+3"], [-3.66], ["-3,66"], ["+5"], ["testo"]]);
  const righe = t.slice(1).split("\r\n");
  assert.deepEqual(righe, ["Nota", "'=1+1", "'+SUM(A1)", "'@cmd", "'-2+3", "-3,66", "-3,66", "+5", "testo"]);
  assert.equal(testoSicuroCsv("\t=1"), "'\t=1");
});
prova("D06: anche il CSV del simulatore neutralizza il nome dello scenario", () => {
  const r = simula({ annoBase: baseS, anni: anniS, bufferPct: 20 });
  const csv = righeCsv({ nome: "=HYPERLINK(\"x\")", comune: "Comune", durata: 10, anno_inizio: 2027 }, r);
  // Nessuna cella inizia con un carattere di formula (le celle sono tra virgolette).
  assert.equal(/(^|;)"[=+@]/m.test(csv), false);
  // I numeri negativi restano numeri.
  assert.equal(testoSicuroCsv("-12,5"), "-12,5");
});

/* ---------------- Riserve: comportamento attuale fissato ---------------- */
prova("R01 (riserva aperta): calcolatore 20%, simulatore 30% con le stesse opzioni", () => {
  const b1 = calcolaBuffer({ soloVirtuose: true, bufferVirtuose: 20, utenzeMonitorate: { res: true, nonres: true, und: true }, rifiutiMisurati: { indifferenziato: true, organico: true }, tariffaPuntuale: true }).totale;
  const b2 = bufferMetodologia({ soloVirtuose: true, utenze: "tutte", rifiuti: "rur_org", tariffaPuntuale: true }).totale;
  assert.equal(b1, 20);
  assert.equal(b2, 30);
});
prova("R02 (riserva aperta): la normale non troncata supera il 100% dell'atteso", () => {
  vicino(quotaVirtuose(0, 0.3), 1.0000335671460712, 1e-12);
  vicino(quotaVirtuose(0, 1.5), 1.2266795361199472, 1e-12);
});

console.log(`${n} prove superate (collaudo V01).`);
