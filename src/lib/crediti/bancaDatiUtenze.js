/* =========================================================================
   bancaDatiUtenze.js — Banca Dati Utenze del calcolo dei crediti, una riga
   per utenza (richieste di Luca Moretti del 22/10/2026). Funzioni pure,
   usate dal portale e dai test (test/bancaDatiUtenze.test.mjs).

   Scopo: legge il file «Banca dati utenze CWP» (modello
   public/modelli/Banca_dati_utenze_CWP_v1.xlsx, generato da
   strumenti/genera_banca_dati_utenze.py), controlla ogni riga e la
   trasforma nella riga della tabella calcolo_utenza (script 40);
   controlla anche l'utenza scritta nel modulo del portale.

   Regole (le stesse del database, che resta la garanzia):
   - ogni anno l'elenco è COMPLETO: il caricamento sostituisce quello
     precedente del calcolo;
   - obbligatori: codice (unico nel file), produzione totale in kg, kg di
     indifferenziato;
   - facoltativi: categoria tariffaria (se presente il database la propone
     come categoria di simulazione), componenti (solo domestiche, intero
     1-30), mq (> 0), kg delle altre frazioni (>= 0, vuoto = non misurata),
     svuotamenti (interi >= 0, solo per una frazione con i kg);
   - produzione totale diversa dalla somma delle frazioni oltre l'1% (e
     oltre 1 kg): avviso, non errore;
   - un file con anche una sola riga sbagliata non si importa (tutto o
     niente, come il tracciato: collaudo V01, D07).

   Dati personali (rilievo T29 del 29/10/2026 e DPIA, azione A1; scelta di
   Luca del 30/10/2026): il portale NON conserva nomi e indirizzi. Ogni
   utenza è solo un codice (pseudonimizzazione: la corrispondenza
   codice-nome resta al Comune). Le colonne «Nome capofamiglia»,
   «Ragione sociale» e «Indirizzo» non sono più nel modello; se un file le
   ha ancora, si ignorano e un avviso lo dice. Prima (22/10) erano
   obbligatorie.

   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti».
   ========================================================================= */
import { leggiFileFogli, righeFoglio, numero, normalizza } from "./tracciato.js";

export const FOGLI_BDU = ["Utenze_domestiche", "Utenze_non_domestiche"];

// Frazioni nell'ordine del modello: [id di parametri.js, nome della colonna].
export const FRAZIONI_BDU = [
  ["indifferenziato", "Indifferenziato"],
  ["organico", "Organico"],
  ["carta", "Carta e cartone"],
  ["plastica", "Plastica"],
  ["vetro", "Vetro"],
  ["metallo", "Metallo"],
  ["verde", "Verde"],
  ["legno", "Legno"],
  ["tessili", "Tessili"],
  ["raee", "RAEE"],
  ["ingombranti", "Ingombranti"],
  ["inerti", "Inerti"],
];
const basso = (n) => (n === n.toUpperCase() ? n : n.toLowerCase());

// Colonne di un foglio (per righeFoglio): chiave, intestazioni ammesse, obbligatoria.
function colonne(tipo) {
  const ud = tipo === "UD";
  return [
    { chiave: "codice", titoli: ["Codice utenza", "Codice"], obbligatorio: true },
    { chiave: "categoria_tariffaria", titoli: ["Categoria tariffaria", "Categoria", "Classe"] },
    ...(ud ? [{ chiave: "componenti", titoli: ["N. componenti", "Componenti"] }] : []),
    { chiave: "mq", titoli: ud ? ["Mq abitazione", "Mq", "Superficie"] : ["Mq locali", "Mq", "Superficie"] },
    { chiave: "produzione_totale_kg", titoli: ["Produzione totale (kg)", "Produzione totale"], obbligatorio: true },
    ...FRAZIONI_BDU.map(([id, nome]) => ({ chiave: "kg_" + id, titoli: [`${nome} (kg)`], obbligatorio: id === "indifferenziato" })),
    ...FRAZIONI_BDU.map(([id, nome]) => ({ chiave: "sv_" + id, titoli: [`Svuotamenti ${basso(nome)}`] })),
  ];
}

const testo = (v) => (v === null || v === undefined ? "" : String(v).trim());
// Categoria: i numeri di Excel diventano testo senza decimali inutili (3 → "3").
const categoria = (v) => {
  const t = testo(v);
  if (!t) return null;
  return typeof v === "number" && Number.isInteger(v) ? String(v) : t;
};

/* Controlla un'utenza (riga del database: codice, tipo, nominativo,
   indirizzo, componenti, mq, categoria_tariffaria, categoria_simulazione,
   produzione_totale_kg, frazioni { id: { kg, svuotamenti? } }).
   Restituisce { errori: [testo], avvisi: [testo] }. Usata per le righe del
   file e per il modulo del portale. */
export function controllaUtenza(u) {
  const errori = [];
  const avvisi = [];
  const ud = u.tipo === "UD";
  if (!testo(u.codice)) errori.push("manca il codice utenza");
  else if (testo(u.codice).length > 60) errori.push("codice utenza troppo lungo (massimo 60 caratteri)");
  if (u.tipo !== "UD" && u.tipo !== "UnD") errori.push("tipo di utenza non valido");
  if (u.componenti != null) {
    if (!ud) errori.push("il numero di componenti vale solo per le utenze domestiche");
    else if (!Number.isInteger(u.componenti) || u.componenti < 1 || u.componenti > 30) errori.push(`componenti «${u.componenti}» non ammessi (intero da 1 a 30)`);
  }
  if (u.mq != null && !(Number.isFinite(u.mq) && u.mq > 0 && u.mq < 1000000)) errori.push(`mq «${u.mq}» non ammessi (numero maggiore di 0)`);
  if (!(Number.isFinite(u.produzione_totale_kg) && u.produzione_totale_kg >= 0)) errori.push("produzione totale mancante o non valida (kg, 0 o più)");
  const fr = u.frazioni || {};
  if (!fr.indifferenziato) errori.push("mancano i kg di indifferenziato (obbligatori, anche 0)");
  let somma = 0;
  for (const [id, v] of Object.entries(fr)) {
    const nome = (FRAZIONI_BDU.find(([f]) => f === id) || [id, id])[1];
    if (!FRAZIONI_BDU.some(([f]) => f === id)) { errori.push(`frazione sconosciuta: ${id}`); continue; }
    if (!(Number.isFinite(v.kg) && v.kg >= 0)) errori.push(`kg di ${basso(nome)} non validi`);
    else somma += v.kg;
    if (v.svuotamenti != null && !(Number.isInteger(v.svuotamenti) && v.svuotamenti >= 0)) errori.push(`svuotamenti di ${basso(nome)} non validi (intero, 0 o più)`);
  }
  if (!errori.length && Number.isFinite(u.produzione_totale_kg)) {
    const diff = Math.abs(u.produzione_totale_kg - somma);
    if (diff > 1 && diff > u.produzione_totale_kg * 0.01) {
      avvisi.push(`produzione totale ${u.produzione_totale_kg.toLocaleString("it-IT")} kg diversa dalla somma delle frazioni ${somma.toLocaleString("it-IT")} kg`);
    }
  }
  if (!testo(u.categoria_simulazione) && !testo(u.categoria_tariffaria)) avvisi.push("senza categoria: va assegnata la categoria di simulazione");
  return { errori, avvisi };
}

// Trasforma una riga del foglio in utenza; i valori non numerici restano
// NaN e li segnala controllaUtenza.
function rigaInUtenza(r, tipo, errori) {
  const n = (v) => {
    const x = numero(v);
    return x === null ? null : x;
  };
  const frazioni = {};
  for (const [id, nome] of FRAZIONI_BDU) {
    const kg = n(r["kg_" + id]);
    const sv = n(r["sv_" + id]);
    if (kg === null) {
      if (sv !== null) errori.push(`svuotamenti di ${basso(nome)} senza i kg`);
      continue;
    }
    frazioni[id] = sv === null ? { kg } : { kg, svuotamenti: sv };
  }
  const tc = categoria(r.categoria_tariffaria);
  return {
    codice: testo(r.codice),
    tipo,
    nominativo: null,
    indirizzo: null,
    componenti: tipo === "UD" ? n(r.componenti) : null,
    mq: n(r.mq),
    categoria_tariffaria: tc,
    categoria_simulazione: tc,
    produzione_totale_kg: n(r.produzione_totale_kg),
    frazioni,
  };
}

/* Interpreta i fogli letti dal file. Restituisce:
   { utenze, errori (bloccanti: righe sbagliate o colonne mancanti), avvisi,
     conteggi: { UD, UnD, senzaCategoria } }.
   Con errori non si importa nulla. Al massimo 30 messaggi di riga. */
export function interpretaBancaDati(fogli) {
  const errori = [];
  const avvisi = [];
  const utenze = [];
  const codici = new Map();
  let righeErrate = 0;
  let righeAvviso = 0;
  for (const [foglio, tipo] of [["Utenze_domestiche", "UD"], ["Utenze_non_domestiche", "UnD"]]) {
    const nomeFoglio = Object.keys(fogli).find((k) => normalizza(k) === normalizza(foglio));
    if (!nomeFoglio) continue;
    // T29: colonne di nomi e indirizzi ignorate (non si leggono né si salvano).
    const intest = (fogli[nomeFoglio]?.[0] || []).map((h) => normalizza(h));
    const personali = ["Nome capofamiglia", "Capofamiglia", "Nominativo", "Ragione sociale", "Denominazione", "Indirizzo"].filter((t) => intest.includes(normalizza(t)));
    if (personali.length) {
      avvisi.push(`${foglio}: le colonne ${personali.join(", ")} sono state ignorate. Il portale non conserva nomi e indirizzi: basta il codice utenza (la corrispondenza resta al Comune).`);
    }
    for (const r of righeFoglio(fogli[nomeFoglio], colonne(tipo), foglio, errori)) {
      const erroriRiga = [];
      const u = rigaInUtenza(r, tipo, erroriRiga);
      const esito = controllaUtenza(u);
      erroriRiga.push(...esito.errori);
      if (u.codice) {
        const chiave = u.codice.toLowerCase();
        if (codici.has(chiave)) erroriRiga.push(`codice ${u.codice} già usato alla riga ${codici.get(chiave)}`);
        else codici.set(chiave, `${r._riga} di ${foglio}`);
      }
      if (erroriRiga.length) {
        righeErrate++;
        if (errori.length < 30) errori.push(`${foglio}, riga ${r._riga}${u.codice ? ` (${u.codice})` : ""}: ${erroriRiga.join("; ")}`);
        continue;
      }
      const avvisiRiga = esito.avvisi.filter((a) => !a.startsWith("senza categoria"));
      if (avvisiRiga.length) {
        righeAvviso++;
        if (avvisi.length < 30) avvisi.push(`${foglio}, riga ${r._riga} (${u.codice}): ${avvisiRiga.join("; ")}`);
      }
      utenze.push(u);
    }
  }
  if (righeErrate > 30) errori.push(`… e altre ${righeErrate - 30} righe con errori.`);
  if (righeAvviso > 30) avvisi.push(`… e altre ${righeAvviso - 30} righe con avvisi.`);
  if (!errori.length && !utenze.length) errori.push("Il file non contiene utenze: compilate i fogli Utenze_domestiche e Utenze_non_domestiche dalla riga 2.");
  const senzaCategoria = utenze.filter((u) => !u.categoria_simulazione).length;
  if (senzaCategoria) avvisi.push(`${senzaCategoria} utenze senza categoria tariffaria: la categoria di simulazione va assegnata nel portale.`);
  return {
    utenze: errori.length ? [] : utenze,
    errori,
    avvisi,
    conteggi: { UD: utenze.filter((u) => u.tipo === "UD").length, UnD: utenze.filter((u) => u.tipo === "UnD").length, senzaCategoria },
  };
}

// Legge il file caricato (Excel o ZIP di CSV) e lo interpreta.
export async function leggiBancaDati(buffer, nome = "") {
  const { fogli } = await leggiFileFogli(buffer, nome, FOGLI_BDU,
    `Il file ${nome ? "«" + nome + "» " : ""}non contiene i fogli Utenze_domestiche e Utenze_non_domestiche: usate il modello «Banca dati utenze CWP».`);
  return interpretaBancaDati(fogli);
}

// Somma dei kg delle frazioni e quota di differenziata (tutto tranne
// l'indifferenziato) di un'utenza: per le tabelle del portale.
export function riepilogoUtenza(u) {
  const fr = u.frazioni || {};
  const somma = Object.values(fr).reduce((s, v) => s + (Number(v.kg) || 0), 0);
  const indiff = Number(fr.indifferenziato?.kg) || 0;
  return { somma, indifferenziato: indiff, differenziataPct: somma > 0 ? ((somma - indiff) / somma) * 100 : null };
}
