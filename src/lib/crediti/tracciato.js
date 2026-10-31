/* =========================================================================
   tracciato.js — import del TRACCIATO DATI CWP (v1.0) nel calcolo dei crediti
   (backlog 1-5, 18/10/2026). Funzioni pure, usate dal portale e dai test
   (test/tracciato.test.mjs).

   Scopo: legge il file del tracciato compilato dal Comune o dal gestore,
   blocca l'import se trova dati personali, converte i fogli nei dati del
   motore di calcolo (calcolo.js) e segnala le incoerenze.

   Usato da: src/components/crediti/ImportaTracciato.jsx (tutte le
   funzioni) e src/pages/CalcoloCrediti.jsx (controllaCoerenza);
   test/tracciato.test.mjs (con i file di test/dati/).

   Dati/servizi coinvolti: nessuna chiamata al database; il salvataggio lo
   fa la pagina con archivio.js. Il modello vuoto da compilare è
   public/modelli/Tracciato_dati_CWP_v1.xlsx (generato da
   strumenti/genera_tracciato_dati.py):
   nomi dei fogli (FOGLI_TRACCIATO) e intestazioni delle colonne (COL) qui
   devono restare uguali a quelli del modello. Se si cambia il tracciato,
   aggiornare insieme: questo file, lo script Python, i file di esempio
   (strumenti/genera_esempi_tracciato.py) e i test.

   Sicurezza / privacy: il controllo dei dati personali avviene nel browser,
   PRIMA che qualunque dato venga salvato. È un controllo euristico
   (intestazioni e forme tipiche dei valori), non una garanzia assoluta.

   Uso dei test: npm test (comprende test/tracciato.test.mjs).

   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti»; capitolo 6
   «Portale (frontend)».

   Flusso:
   1. leggiFileTracciato(buffer, nome)  → fogli: { "2_Rifiuti": [[celle]], … }
      - file Excel .xlsx (letto con JSZip: un .xlsx è uno ZIP di file XML);
      - oppure archivio .zip di file CSV con gli stessi nomi dei fogli
        (es. 6_Letture.csv), per i dati troppo grandi per Excel.
   2. controllaPrivacy(fogli)           → dati personali trovati (blocca l'import)
   3. interpretaTracciato(fogli, anno)  → dati del calcolo: anagrafica, rifiuti,
      classi della delibera, conferimenti (anche aggregando le singole
      letture del foglio 6_Letture), riuso, avvisi.
   4. controllaCoerenza(...)            → incongruenze da verificare.
   ========================================================================= */
import JSZip from "jszip";
import { leggiCsv } from "../csv.js";
import { TIPOLOGIE_RIFIUTO, BENI_RIUSO } from "./parametri.js";
import { valoriNonAmmessiBdu } from "./calcolo.js";

// Nomi dei fogli del tracciato, nell'ordine del modello Excel.
export const FOGLI_TRACCIATO = ["1_Anagrafica", "2_Rifiuti", "3_Classi_domestiche", "4_Classi_non_domestiche", "5_Conferimenti", "6_Letture", "7_Riuso"];
const ID_TIPOLOGIE = TIPOLOGIE_RIFIUTO.map((t) => t.id);
const ID_BENI = BENI_RIUSO.map((b) => b.id);

// "Peso strutture informatizzate (kg)" → "pesostruttureinformatizzatekg"
// Rende il confronto di intestazioni e codici indipendente da maiuscole,
// accenti, spazi e punteggiatura.
export const normalizza = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");

/* ---------------------------------------------------------------------
   1. Lettura del file
   --------------------------------------------------------------------- */

// Decodifica le entità XML (&amp; &lt; … &#233;).
// &amp; va sostituito per ultimo, altrimenti "&amp;lt;" diventerebbe "<".
function xmlTesto(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
// Valore di un attributo XML in un tag (es. name="2_Rifiuti"), già decodificato; null se assente.
const attributo = (tag, nome) => {
  const m = new RegExp(`\\b${nome}="([^"]*)"`).exec(tag);
  return m ? xmlTesto(m[1]) : null;
};

// "AB12" → indice di colonna 27 (A = 0)
function colonna(rif) {
  const lettere = /^[A-Z]+/.exec(rif)?.[0] || "A";
  let n = 0;
  for (const ch of lettere) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Legge un .xlsx: restituisce { nomeFoglio: [[valori]] } con le sole celle valorizzate.
// Lettore minimo scritto apposta (nessuna libreria Excel): workbook.xml dà
// i nomi dei fogli, workbook.xml.rels il file XML di ciascuno,
// sharedStrings.xml i testi condivisi. Non legge formule (solo il valore
// già calcolato e salvato da Excel) né formati: le date arrivano come
// numeri seriali (vedi data()).
async function leggiXlsx(zip) {
  const leggi = async (p) => (zip.file(p) ? await zip.file(p).async("string") : null);
  const workbook = await leggi("xl/workbook.xml");
  const rels = (await leggi("xl/_rels/workbook.xml.rels")) || "";
  const condivise = [];
  const ss = await leggi("xl/sharedStrings.xml");
  if (ss) {
    for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      condivise.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => xmlTesto(t[1])).join(""));
    }
  }
  const destinazioni = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attributo(m[0], "Id");
    let t = attributo(m[0], "Target") || "";
    t = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "");
    destinazioni[id] = t;
  }
  const fogli = {};
  for (const m of (workbook || "").matchAll(/<sheet\b[^>]*>/g)) {
    const nome = attributo(m[0], "name");
    const rid = attributo(m[0], "r:id");
    const xml = destinazioni[rid] ? await leggi(destinazioni[rid]) : null;
    if (!nome || !xml) continue;
    const righe = [];
    for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const nRiga = Number(attributo(r[1], "r")) - 1;
      const celle = [];
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        // Tipo di cella: s = testo condiviso, inlineStr = testo nella cella,
        // str = risultato testuale di formula, b = booleano, e = errore,
        // assente = numero.
        const tipo = attributo(c[1], "t");
        const corpo = c[2] || "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
        let valore = null;
        if (tipo === "s") valore = v != null ? condivise[Number(v)] ?? "" : null;
        else if (tipo === "inlineStr") valore = [...corpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => xmlTesto(t[1])).join("");
        else if (tipo === "str") valore = v != null ? xmlTesto(v) : null;
        else if (tipo === "b") valore = v === "1";
        else if (tipo === "e") valore = null;
        else valore = v != null && v !== "" ? Number(v) : null;
        if (valore === null || valore === "") continue;
        celle[colonna(attributo(c[1], "r") || "A")] = valore;
      }
      // Si rispetta il numero di riga di Excel (attributo r): le righe vuote
      // saltate da Excel restano buchi, poi riempiti con [].
      if (celle.length) righe[nRiga >= 0 ? nRiga : righe.length] = celle;
    }
    fogli[nome] = Array.from(righe, (x) => x || []);
  }
  return fogli;
}

// Legge un file Excel o uno ZIP di CSV e restituisce i fogli attesi.
// Parametri: contenuto del file (ArrayBuffer o Buffer), nome (per i
// messaggi), elenco dei nomi di foglio attesi (per riconoscere i CSV, anche
// senza il numero iniziale: «Letture.csv»), messaggio d'errore se non ne
// trova nessuno. Restituisce { tipo: "xlsx" | "zip-csv", fogli }.
// Usata dal tracciato (sotto) e dalla Banca Dati Utenze (bancaDatiUtenze.js).
export async function leggiFileFogli(buffer, nome, fogliAttesi, messaggio) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error(`Il file ${nome ? "«" + nome + "» " : ""}non è un file Excel (.xlsx) né un archivio ZIP.`);
  }
  if (zip.file("xl/workbook.xml")) return { tipo: "xlsx", fogli: await leggiXlsx(zip) };
  // ZIP di CSV: ogni file "<foglio>.csv" (anche dentro una cartella).
  const fogli = {};
  for (const percorso of Object.keys(zip.files)) {
    if (zip.files[percorso].dir || !/\.csv$/i.test(percorso)) continue;
    const base = percorso.split("/").pop().replace(/\.csv$/i, "");
    const foglio = fogliAttesi.find((f) => normalizza(f) === normalizza(base) || normalizza(f).slice(1) === normalizza(base));
    if (!foglio) continue;
    fogli[foglio] = leggiCsv(await zip.file(percorso).async("string"));
  }
  if (!Object.keys(fogli).length) throw new Error(messaggio);
  return { tipo: "zip-csv", fogli };
}

// Legge il file del tracciato (Excel o ZIP di CSV).
// Lancia un errore se il file non è uno ZIP o non contiene fogli del tracciato.
export async function leggiFileTracciato(buffer, nome = "") {
  return leggiFileFogli(buffer, nome, FOGLI_TRACCIATO,
    `Il file ${nome ? "«" + nome + "» " : ""}non contiene il tracciato: serve il file Excel del tracciato oppure uno ZIP con i fogli in CSV (es. 6_Letture.csv).`);
}

/* ---------------------------------------------------------------------
   2. Controllo dei dati personali (tracciato: «NIENTE nomi, indirizzi o
      codici fiscali»). Il foglio 1_Anagrafica è escluso: contiene i dati
      dell'ufficio comunale, non delle utenze.
   --------------------------------------------------------------------- */
// Intestazioni (già normalizzate) che indicano una colonna di dati personali.
// Il controllo è "inizia con": anche "nomeutente" o "viaecivico" sono bloccati.
const INTESTAZIONI_PERSONALI = /^(nome|cognome|nominativo|ragionesociale|intestatario|contribuente|indirizzo|via|civico|residenza|codicefiscale|cf|partitaiva|piva|email|mail|pec|telefono|tel|cellulare|iban)/;
// Forme tipiche di valori personali, cercate in ogni cella di testo:
// codice fiscale (16 caratteri), email, IBAN italiano, telefono, indirizzo.
const CONTROLLI_VALORI = [
  { tipo: "codice fiscale", re: /\b[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z]\d{3}[A-Z]\b/i },
  { tipo: "email", re: /[^\s@]+@[^\s@]+\.[a-z]{2,}/i },
  { tipo: "IBAN", re: /\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/i },
  { tipo: "numero di telefono", re: /^(\+39\s?)?(3\d{2}|0\d{1,3})[\s./-]?\d{5,8}$/ },
  { tipo: "indirizzo", re: /\b(via|viale|piazza|p\.zza|corso|vicolo|località|loc\.)\s+[a-zà-ù]/i },
];
// Oscura un valore trovato: "RSSMRA80A01H501U" → "RSS…01U"
// (il dato personale non viene mostrato per intero nemmeno nel messaggio).
const oscura = (s) => {
  const t = String(s);
  return t.length <= 6 ? "…" : `${t.slice(0, 3)}…${t.slice(-3)}`;
};

// Cerca dati personali nei fogli da 2 a 7.
// Parametro: fogli come restituiti da leggiFileTracciato.
// Restituisce al massimo 50 segnalazioni { foglio, riga, tipo, esempio };
// elenco non vuoto = import da bloccare. Una colonna "personale" conta solo
// se ha almeno un valore sotto l'intestazione.
export function controllaPrivacy(fogli) {
  const trovati = [];
  for (const nome of FOGLI_TRACCIATO.slice(1)) {
    const righe = fogli[nome];
    if (!righe?.length) continue;
    const intest = (righe[0] || []).map((h) => normalizza(h));
    intest.forEach((h, j) => {
      if (h && INTESTAZIONI_PERSONALI.test(h) && righe.slice(1).some((r) => r?.[j] !== undefined && r?.[j] !== "")) {
        trovati.push({ foglio: nome, riga: 1, tipo: "colonna con dati personali", esempio: righe[0][j] });
      }
    });
    for (let i = 1; i < righe.length && trovati.length < 50; i++) {
      (righe[i] || []).forEach((v) => {
        if (typeof v !== "string") return;
        const c = CONTROLLI_VALORI.find((k) => k.re.test(v.trim()));
        if (c) trovati.push({ foglio: nome, riga: i + 1, tipo: c.tipo, esempio: oscura(v.trim()) });
      });
    }
  }
  return trovati.slice(0, 50);
}

/* ---------------------------------------------------------------------
   3. Interpretazione dei fogli
   --------------------------------------------------------------------- */

// Numero da cella: accetta numeri Excel e testi "1.234,5" o "1234.5".
// Restituisce null se la cella è vuota, NaN se il testo non è un numero
// (così il chiamante distingue "manca" da "sbagliato").
// Se c'è la virgola, i punti sono separatori delle migliaia.
export function numero(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, "");
  if (!s) return null;
  const t = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
// Valore sì/no da cella: booleano di Excel o testi come "sì", "x", "1".
const siNo = (v) => v === true || /^(si|sì|s|true|1|x|vero|yes)$/i.test(String(v ?? "").trim());

// Data da cella: numero seriale di Excel o testo gg/mm/aaaa (o aaaa-mm-gg).
// Restituisce una Date in UTC (usare getUTCFullYear ecc.) oppure null.
// Seriale Excel: giorni dal 30/12/1899 (questa base compensa il finto
// 29/02/1900 di Excel per tutte le date dal 1° marzo 1900 in poi); si
// accettano i seriali da 1 (1/1/1900) a 2958465 (31/12/9999).
// Giorno e mese devono esistere (collaudo V01, D04): 31/02/2025 o 13/13/2025
// danno null, cioè «data non valida» (la riga si scarta con il motivo);
// il 29/02 vale solo negli anni bisestili. Prima 31/02 diventava 3 marzo.
export function data(v) {
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 1 || v > 2958465) return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
  }
  const s = String(v ?? "").trim();
  // Costruisce la data solo se esiste davvero nel calendario.
  const vera = (a, m, g) => {
    const d = new Date(Date.UTC(a, m - 1, g));
    return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g ? d : null;
  };
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
  if (m) return vera(+m[3], +m[2], +m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return vera(+m[1], +m[2], +m[3]);
  return null;
}

// Macrocategoria da cella: "UD" (domestica) o "UnD" (non domestica); null se non riconosciuta.
function macro(v) {
  const s = normalizza(v);
  if (["ud", "domestica", "domestiche", "d"].includes(s)) return "UD";
  if (["und", "nondomestica", "nondomestiche", "nd"].includes(s)) return "UnD";
  return null;
}
// Tipologia di rifiuto da cella: deve coincidere con un id di
// TIPOLOGIE_RIFIUTO (parametri.js), es. "organico"; altrimenti null.
function tipologia(v) {
  const s = normalizza(v);
  return ID_TIPOLOGIE.find((t) => normalizza(t) === s) || null;
}

// Trasforma un foglio in oggetti secondo le colonne attese (intestazioni della riga 1).
// Parametri: righe del foglio, colonne (voce di COL), nome del foglio per i
// messaggi, array "errori" da riempire. Restituisce oggetti con le chiavi di
// COL più _riga (numero di riga Excel). Un foglio vuoto non è un errore;
// un foglio compilato senza una colonna obbligatoria viene ignorato tutto.
export function righeFoglio(righe, colonne, nomeFoglio, errori) {
  if (!righe?.length) return [];
  const intest = (righe[0] || []).map((h) => normalizza(h));
  const indici = {};
  const mancanti = [];
  for (const col of colonne) {
    const i = intest.findIndex((h) => col.titoli.some((t) => normalizza(t) === h));
    if (i >= 0) indici[col.chiave] = i;
    else if (col.obbligatorio) mancanti.push(col.titoli[0]);
  }
  // Righe non vuote, con il loro numero nel foglio (la riga 1 è l'intestazione).
  const dati = [];
  for (let i = 1; i < righe.length; i++) {
    const r = righe[i];
    if (r && r.some((v) => v !== undefined && v !== null && v !== "")) dati.push([r, i + 1]);
  }
  if (!dati.length) return [];
  if (mancanti.length) {
    errori.push(`${nomeFoglio}: mancano le colonne ${mancanti.join(", ")} (non modificate le intestazioni del tracciato).`);
    return [];
  }
  return dati.map(([r, nRiga]) => {
    const o = { _riga: nRiga };
    for (const col of colonne) o[col.chiave] = indici[col.chiave] === undefined ? null : r[indici[col.chiave]] ?? null;
    return o;
  });
}

// Colonne attese in ciascun foglio: chiave interna, intestazioni ammesse
// (la prima è quella del modello, le altre varianti tollerate), obbligatoria.
// Le chiavi coincidono con i campi usati da calcolo.js e archivio.js.
const COL = {
  rifiuti: [
    { chiave: "codice", titoli: ["Codice EER"], obbligatorio: true },
    { chiave: "descrizione", titoli: ["Descrizione"] },
    { chiave: "tipologia", titoli: ["Tipologia"], obbligatorio: true },
    { chiave: "qtot", titoli: ["Quantità (t/anno)", "Quantita"], obbligatorio: true },
    { chiave: "soloDomestiche", titoli: ["Solo domestiche"] },
  ],
  classiUd: [
    { chiave: "classe", titoli: ["Classe"], obbligatorio: true },
    { chiave: "n", titoli: ["N. utenze"], obbligatorio: true },
    { chiave: "kb", titoli: ["Kb"], obbligatorio: true },
  ],
  classiUnd: [
    { chiave: "classe", titoli: ["Categoria", "Classe"], obbligatorio: true },
    { chiave: "n", titoli: ["N. utenze"], obbligatorio: true },
    { chiave: "superficie", titoli: ["Superficie (m²)", "Superficie (m2)", "Superficie"], obbligatorio: true },
    { chiave: "kd", titoli: ["Kd (kg/m²/anno)", "Kd"], obbligatorio: true },
  ],
  conferimenti: [
    { chiave: "utenza", titoli: ["Utenza"], obbligatorio: true },
    { chiave: "macro", titoli: ["Macrocategoria"], obbligatorio: true },
    { chiave: "classe", titoli: ["Classe"], obbligatorio: true },
    { chiave: "tipologia", titoli: ["Tipologia rifiuto"], obbligatorio: true },
    { chiave: "svuotamenti", titoli: ["Svuotamenti"] },
    { chiave: "volume", titoli: ["Volume contenitore (L)"] },
    { chiave: "pesoStrutture", titoli: ["Peso strutture informatizzate (kg)"] },
    { chiave: "volumeStrutture", titoli: ["Volume strutture informatizzate (L)"] },
    { chiave: "pesoCdr", titoli: ["Peso centri di raccolta (kg)"] },
    { chiave: "volumeCdr", titoli: ["Volume centri di raccolta (L)"] },
    { chiave: "nUtenze", titoli: ["N. utenze (valori medi)"] },
  ],
  letture: [
    { chiave: "utenza", titoli: ["Utenza"], obbligatorio: true },
    { chiave: "macro", titoli: ["Macrocategoria"], obbligatorio: true },
    { chiave: "classe", titoli: ["Classe"], obbligatorio: true },
    { chiave: "tipologia", titoli: ["Tipologia rifiuto"], obbligatorio: true },
    { chiave: "data", titoli: ["Data"], obbligatorio: true },
    { chiave: "punto", titoli: ["Punto di conferimento"], obbligatorio: true },
    { chiave: "volume", titoli: ["Volume contenitore (L)"] },
    { chiave: "peso", titoli: ["Peso (kg)"] },
  ],
  riuso: [
    { chiave: "utenza", titoli: ["Utenza"], obbligatorio: true },
    { chiave: "macro", titoli: ["Macrocategoria"], obbligatorio: true },
    { chiave: "classe", titoli: ["Classe"], obbligatorio: true },
    { chiave: "bene", titoli: ["Bene"], obbligatorio: true },
    { chiave: "pezzi", titoli: ["Pezzi"] },
    { chiave: "peso", titoli: ["Peso (kg)"] },
    { chiave: "nUtenze", titoli: ["N. utenze (valori medi)"] },
  ],
};

// Voci del foglio 1_Anagrafica (colonna A = voce, colonna B = valore).
// Riconosce le voci dall'inizio del testo normalizzato (es. "Ente …").
// Restituisce { ente, istat, anno, gestore, software, tariffaPuntuale,
// pefUd, pefUnd, delibera } con le sole voci compilate.
function leggiAnagrafica(righe) {
  const a = {};
  for (const r of righe || []) {
    const voce = normalizza(r?.[0]);
    const v = r?.[1];
    if (!voce || v === undefined || v === null || v === "") continue;
    if (voce.startsWith("ente")) a.ente = String(v);
    else if (voce.startsWith("codiceistat")) a.istat = String(v);
    else if (voce.startsWith("annodiriferimento")) a.anno = Number(String(v).replace(/\D/g, "")) || null;
    else if (voce.startsWith("gestore")) a.gestore = String(v);
    else if (voce.startsWith("softwaredigestione")) a.software = String(v);
    else if (voce === "tariffapuntualeattiva") a.tariffaPuntuale = siNo(v);
    else if (voce.startsWith("pefutenzedomestiche")) a.pefUd = numero(v);
    else if (voce.startsWith("pefutenzenondomestiche")) a.pefUnd = numero(v);
    else if (voce.startsWith("estremidelladelibera")) a.delibera = String(v);
  }
  return a;
}

/* Interpreta i fogli letti. annoCalcolo: anno di riferimento del calcolo
   (le singole letture fuori da quell'anno sono escluse).
   Restituisce { anagrafica, rifiuti, classiUd, classiUnd, conferimenti,
   riuso, conteggi, errori (fogli inutilizzabili), avvisi, scarti (prime
   200 righe scartate con il motivo), scartiTotali }.
   Le righe con valori non validi si scartano una per una: il resto del
   foglio viene comunque importato. */
export function interpretaTracciato(fogli, annoCalcolo) {
  const errori = [];
  const avvisi = [];
  const scarti = [];
  const anagrafica = leggiAnagrafica(fogli["1_Anagrafica"]);
  const scarta = (foglio, riga, motivo) => scarti.push(`${foglio}, riga ${riga}: ${motivo}`);

  // Valida i numeri di un oggetto: null se vuoti, scarto se non numerici o negativi.
  const numeri = (o, chiavi, foglio) => {
    for (const k of chiavi) {
      const n = numero(o[k]);
      if (Number.isNaN(n) || (n !== null && n < 0)) {
        scarta(foglio, o._riga, `«${o[k]}» non è un numero valido (${k})`);
        return false;
      }
      o[k] = n;
    }
    return true;
  };

  // 2_Rifiuti
  const rifiuti = [];
  for (const r of righeFoglio(fogli["2_Rifiuti"], COL.rifiuti, "2_Rifiuti", errori)) {
    const t = tipologia(r.tipologia);
    if (!t) { scarta("2_Rifiuti", r._riga, `tipologia «${r.tipologia}» sconosciuta`); continue; }
    if (!numeri(r, ["qtot"], "2_Rifiuti")) continue;
    rifiuti.push({ codice: String(r.codice).trim(), descrizione: r.descrizione ? String(r.descrizione) : "", tipologia: t, qtot: r.qtot, soloDomestiche: siNo(r.soloDomestiche), considerato: true });
  }

  // 3 e 4: classi della delibera
  const classiUd = [];
  for (const r of righeFoglio(fogli["3_Classi_domestiche"], COL.classiUd, "3_Classi_domestiche", errori)) {
    if (!numeri(r, ["n", "kb"], "3_Classi_domestiche")) continue;
    classiUd.push({ classe: String(r.classe).trim(), n: r.n, kb: r.kb });
  }
  const classiUnd = [];
  for (const r of righeFoglio(fogli["4_Classi_non_domestiche"], COL.classiUnd, "4_Classi_non_domestiche", errori)) {
    if (!numeri(r, ["n", "superficie", "kd"], "4_Classi_non_domestiche")) continue;
    classiUnd.push({ classe: String(r.classe).trim(), n: r.n, superficie: r.superficie, kd: r.kd });
  }

  // 5_Conferimenti (totali annui)
  const conferimenti = [];
  const numeriConf = ["svuotamenti", "volume", "pesoStrutture", "volumeStrutture", "pesoCdr", "volumeCdr", "nUtenze"];
  for (const r of righeFoglio(fogli["5_Conferimenti"], COL.conferimenti, "5_Conferimenti", errori)) {
    const m = macro(r.macro);
    const t = tipologia(r.tipologia);
    if (!m) { scarta("5_Conferimenti", r._riga, `macrocategoria «${r.macro}» (usa UD o UnD)`); continue; }
    if (!t) { scarta("5_Conferimenti", r._riga, `tipologia «${r.tipologia}» sconosciuta`); continue; }
    if (!numeri(r, numeriConf, "5_Conferimenti")) continue;
    const { _riga, ...resto } = r;
    conferimenti.push({ ...resto, utenza: String(r.utenza).trim(), classe: String(r.classe).trim(), macro: m, tipologia: t, nUtenze: r.nUtenze || 1 });
  }

  // 6_Letture (dati grezzi) → totali annui per utenza e tipologia
  // Ogni riga è un singolo conferimento (una lettura del contenitore o una
  // pesata). Si sommano per utenza + macro + classe + tipologia e diventano
  // righe equivalenti a quelle del foglio 5. Il foglio 5, se compilato, ha
  // la precedenza.
  const letture = righeFoglio(fogli["6_Letture"], COL.letture, "6_Letture", errori);
  let lettureUsate = 0;
  let lettureFuoriAnno = 0;
  if (letture.length && conferimenti.length) {
    avvisi.push("Sono compilati sia 5_Conferimenti sia 6_Letture: si usano i totali del foglio 5 e le singole letture sono ignorate.");
  } else if (letture.length) {
    const somme = new Map();
    let pesoDomiciliareIgnorato = 0;
    for (const r of letture) {
      const m = macro(r.macro);
      const t = tipologia(r.tipologia);
      const d = data(r.data);
      const punto = normalizza(r.punto);
      if (!m) { scarta("6_Letture", r._riga, `macrocategoria «${r.macro}»`); continue; }
      if (!t) { scarta("6_Letture", r._riga, `tipologia «${r.tipologia}» sconosciuta`); continue; }
      if (!d) { scarta("6_Letture", r._riga, `data «${r.data}» non valida: giorno inesistente o formato diverso da gg/mm/aaaa`); continue; }
      if (!["domiciliare", "struttura", "centroraccolta"].includes(punto)) { scarta("6_Letture", r._riga, `punto di conferimento «${r.punto}» sconosciuto`); continue; }
      if (!numeri(r, ["volume", "peso"], "6_Letture")) continue;
      if (annoCalcolo && d.getUTCFullYear() !== Number(annoCalcolo)) { lettureFuoriAnno++; continue; }
      // Separatore \u0001: non compare mai nei dati, quindi le chiavi non si confondono.
      const chiave = [String(r.utenza).trim(), m, String(r.classe).trim(), t].join("\u0001");
      if (!somme.has(chiave)) {
        somme.set(chiave, { utenza: String(r.utenza).trim(), macro: m, classe: String(r.classe).trim(), tipologia: t, svuotamenti: 0, litriDom: 0, pesoStrutture: 0, volumeStrutture: 0, pesoCdr: 0, volumeCdr: 0 });
      }
      const s = somme.get(chiave);
      lettureUsate++;
      if (punto === "domiciliare") {
        // Metodologia (formula 19): svuotamenti × volume del contenitore.
        // Ogni lettura domiciliare con volume = uno svuotamento.
        if (r.volume) { s.svuotamenti += 1; s.litriDom += r.volume; }
        else if (r.peso) { s.pesoStrutture += r.peso; pesoDomiciliareIgnorato++; }
      } else if (punto === "struttura") {
        // Strutture informatizzate e centri di raccolta: il peso, se c'è,
        // prevale sul volume (più preciso, non serve il peso specifico).
        if (r.peso) s.pesoStrutture += r.peso; else s.volumeStrutture += r.volume || 0;
      } else {
        if (r.peso) s.pesoCdr += r.peso; else s.volumeCdr += r.volume || 0;
      }
    }
    for (const s of somme.values()) {
      conferimenti.push({
        utenza: s.utenza, macro: s.macro, classe: s.classe, tipologia: s.tipologia,
        svuotamenti: s.svuotamenti || null,
        // volume medio: svuotamenti × volume = litri totali domiciliari
        volume: s.svuotamenti ? Math.round((s.litriDom / s.svuotamenti) * 1000) / 1000 : null,
        pesoStrutture: s.pesoStrutture || null, volumeStrutture: s.volumeStrutture || null,
        pesoCdr: s.pesoCdr || null, volumeCdr: s.volumeCdr || null, nUtenze: 1,
      });
    }
    if (lettureFuoriAnno) avvisi.push(`${lettureFuoriAnno.toLocaleString("it-IT")} letture con data fuori dall'anno ${annoCalcolo}: escluse.`);
    if (pesoDomiciliareIgnorato) avvisi.push(`${pesoDomiciliareIgnorato.toLocaleString("it-IT")} letture domiciliari senza volume ma con peso: il peso è conteggiato come conferimento pesato.`);
  }

  // 7_Riuso
  const riuso = [];
  for (const r of righeFoglio(fogli["7_Riuso"], COL.riuso, "7_Riuso", errori)) {
    const m = macro(r.macro);
    const b = ID_BENI.find((x) => normalizza(x) === normalizza(r.bene));
    if (!m) { scarta("7_Riuso", r._riga, `macrocategoria «${r.macro}»`); continue; }
    if (!b) { scarta("7_Riuso", r._riga, `bene «${r.bene}» sconosciuto (codici: ${ID_BENI.join(", ")})`); continue; }
    if (!numeri(r, ["pezzi", "peso", "nUtenze"], "7_Riuso")) continue;
    riuso.push({ utenza: String(r.utenza).trim(), macro: m, classe: String(r.classe).trim(), bene: b, pezzi: r.pezzi, peso: r.peso, nUtenze: r.nUtenze || 1 });
  }

  return {
    anagrafica,
    rifiuti,
    classiUd,
    classiUnd,
    conferimenti,
    riuso,
    conteggi: {
      rifiuti: rifiuti.length,
      classiUd: classiUd.length,
      classiUnd: classiUnd.length,
      conferimenti: conferimenti.length,
      letture: letture.length,
      lettureUsate,
      riuso: riuso.length,
      utenze: new Set(conferimenti.map((c) => c.utenza)).size,
    },
    errori,
    avvisi,
    scarti: scarti.slice(0, 200),
    scartiTotali: scarti.length,
  };
}

/* ---------------------------------------------------------------------
   4. Controlli di coerenza (backlog 5). Restituisce un elenco di
      { livello: "errore" | "avviso", testo }. Gli "errori" indicano dati
      che falserebbero il calcolo; gli "avvisi" valori da verificare.
   --------------------------------------------------------------------- */
// Numero "tollerante" per i controlli: vuoto o non valido → 0.
const n0 = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

// Parametri: anno del calcolo, anagrafica del tracciato, rifiuti, PEF,
// classi della delibera, Banca Dati Utenze (conferimenti, riuso) e pesi
// specifici di default { tipologia: kg/m³ } per stimare i kg conferiti.
// Le soglie (1,05 × utenze in delibera, 50% di copertura, 366 svuotamenti,
// 5.000 litri, 1,1 × totale del territorio) sono scelte di buon senso, non
// regole della Metodologia: si possono tarare.
// origine: "conferimenti" (passo 5b, tracciato) oppure "utenze" (passo 5a:
// righe di utenzeInConferimenti di calcolo.js, con i kg misurati e la
// categoria di simulazione come classe; 23/10/2026).
export function controllaCoerenza({ anno, anagrafica = {}, rifiuti = [], pefUd, pefUnd, classiUd = [], classiUnd = [], conferimenti = [], riuso = [], ps = {}, origine = "conferimenti", annoRiferimento = null }) {
  const daUtenze = origine === "utenze";
  const esiti = [];
  const errore = (testo) => esiti.push({ livello: "errore", testo });
  const avviso = (testo) => esiti.push({ livello: "avviso", testo });
  const elenco = (insieme, max = 6) => [...insieme].slice(0, max).join(", ") + (insieme.size > max ? "…" : "");

  // Anno
  if (anagrafica.anno && anno && Number(anagrafica.anno) !== Number(anno)) {
    avviso(`L'anno indicato nel tracciato (${anagrafica.anno}) è diverso dall'anno del calcolo (${anno}).`);
  }

  // PEF
  const somma = n0(pefUd) + n0(pefUnd);
  if (!n0(pefUd) && !n0(pefUnd)) errore("Manca la ripartizione PEF tra utenze domestiche e non domestiche.");
  else if (Math.abs(somma - 100) > 0.01) errore(`PEF domestiche + non domestiche = ${somma.toLocaleString("it-IT")}%: deve fare 100%.`);

  // Rifiuti del territorio
  if (!rifiuti.length) errore("Mancano i rifiuti del territorio (foglio 2_Rifiuti).");
  if (rifiuti.length && !rifiuti.some((r) => r.tipologia === "indifferenziato")) errore("Tra i rifiuti del territorio manca l'indifferenziato (EER 200301).");
  const eer = new Map();
  rifiuti.forEach((r) => eer.set(r.codice, (eer.get(r.codice) || 0) + 1));
  const doppi = new Set([...eer].filter(([, k]) => k > 1).map(([c]) => c));
  if (doppi.size) avviso(`Codici EER ripetuti nei rifiuti del territorio: ${elenco(doppi)}.`);

  // Classi della delibera
  if (!classiUd.length) errore("Mancano le classi delle utenze domestiche (foglio 3).");
  const classiNote = { UD: new Set(classiUd.map((c) => String(c.classe).trim())), UnD: new Set(classiUnd.map((c) => String(c.classe).trim())) };
  const senzaKb = classiUd.filter((c) => !n0(c.kb)).map((c) => c.classe);
  if (senzaKb.length) avviso(`Classi domestiche con Kb nullo: ${senzaKb.slice(0, 6).join(", ")}.`);

  if (!conferimenti.length) {
    errore("Manca la Banca Dati Utenze: carica le utenze del calcolo (passo 5a) oppure i conferimenti del tracciato (passo 5b).");
    return esiti;
  }

  // Valori negativi o non numerici (collaudo V01, D07): stesso controllo
  // del motore e del salvataggio (valoriNonAmmessiBdu, calcolo.js).
  const nonAmmessi = valoriNonAmmessiBdu({ conferimenti, riuso });
  if (nonAmmessi.righe) {
    errore(`Banca Dati Utenze con ${nonAmmessi.righe} righe con valori negativi o non numerici: ${nonAmmessi.messaggi.slice(0, 3).join("; ")}${nonAmmessi.righe > 3 ? "…" : ""}.`);
  }

  // Classi della Banca Dati non presenti in delibera. Con le utenze del
  // passo 5a la classe è la categoria di simulazione: quelle senza categoria
  // si contano a parte (vanno assegnate dal modulo dell'utenza).
  const ignote = new Set();
  const senzaCategoria = new Set();
  const conIgnota = new Set();
  conferimenti.forEach((c) => {
    const cl = String(c.classe ?? "").trim();
    if (daUtenze && !cl) { senzaCategoria.add(c.utenza); return; }
    if (!classiNote[c.macro]?.has(cl)) { ignote.add(`${c.macro} «${c.classe}»`); conIgnota.add(c.utenza); }
  });
  if (senzaCategoria.size) {
    errore(`${senzaCategoria.size} utenze senza categoria di simulazione (es. ${elenco(senzaCategoria, 4)}): assegnala dal passo 5a, altrimenti restano fuori dal calcolo.`);
  }
  if (ignote.size) {
    errore(daUtenze
      ? `${conIgnota.size} utenze con una categoria di simulazione che non è tra le classi della delibera (${elenco(ignote)}): correggi la categoria (passo 5a) o le classi (passo 3).`
      : `Classi della Banca Dati Utenze assenti nella delibera (scritte in modo diverso?): ${elenco(ignote)}.`);
  }

  // Stessa utenza con macrocategorie o classi diverse
  const perUtenza = new Map();
  const pesoUtenza = new Map(); // quante utenze rappresenta (valori medi ex ante)
  conferimenti.forEach((c) => {
    const k = `${c.macro}|${c.classe}`;
    if (!perUtenza.has(c.utenza)) perUtenza.set(c.utenza, new Set());
    perUtenza.get(c.utenza).add(k);
    if (!pesoUtenza.has(c.utenza)) pesoUtenza.set(c.utenza, Number(c.nUtenze) || 1);
  });
  const ambigue = new Set([...perUtenza].filter(([, s]) => s.size > 1).map(([u]) => u));
  if (ambigue.size) errore(`Utenze con classi o macrocategorie diverse su righe diverse: ${elenco(ambigue)}.`);

  // Righe duplicate (stessa utenza e tipologia più volte)
  const visti = new Map();
  conferimenti.forEach((c) => { const k = `${c.utenza}|${c.tipologia}`; visti.set(k, (visti.get(k) || 0) + 1); });
  const dup = new Set([...visti].filter(([, k]) => k > 1).map(([k]) => k.replace("|", " / ")));
  if (dup.size) avviso(`Stessa utenza e tipologia su più righe (verranno sommate): ${elenco(dup)}.`);

  // Utenze della Banca Dati rispetto alla delibera, per classe
  // (un'utenza ambigua si conta solo nella prima classe trovata).
  const contaPerClasse = new Map();
  for (const [u, s] of perUtenza) {
    const [k] = [...s];
    contaPerClasse.set(k, (contaPerClasse.get(k) || 0) + pesoUtenza.get(u));
  }
  const oltre = [];
  for (const [k, cont] of contaPerClasse) {
    const [m, classe] = k.split("|");
    const delib = (m === "UD" ? classiUd : classiUnd).find((c) => String(c.classe).trim() === classe);
    if (delib && n0(delib.n) && cont > n0(delib.n) * 1.05) oltre.push(`${classe} (${cont} contro ${n0(delib.n)})`);
  }
  if (oltre.length) avviso(`Più utenze nella Banca Dati che nella delibera: ${oltre.slice(0, 6).join(", ")}.`);
  const totDelibera = [...classiUd, ...classiUnd].reduce((s, c) => s + n0(c.n), 0);
  const totBdu = [...contaPerClasse.values()].reduce((s, v) => s + v, 0);
  if (totDelibera && totBdu < totDelibera * 0.5) {
    avviso(`La Banca Dati copre ${totBdu.toLocaleString("it-IT")} utenze su ${totDelibera.toLocaleString("it-IT")} della delibera (meno della metà): verificate che sia completa.`);
  }

  // Valori anomali
  const tante = conferimenti.filter((c) => n0(c.svuotamenti) > 366).length;
  if (tante) avviso(`${tante} righe con più di 366 svuotamenti nell'anno.`);
  const grandi = conferimenti.filter((c) => n0(c.volume) > 5000).length;
  if (grandi) avviso(`${grandi} righe con contenitore oltre 5.000 litri: verificate l'unità di misura (litri).`);
  // Le righe delle utenze del passo 5a hanno i kg misurati (anche 0 è un
  // dato valido): non contano tra le righe vuote.
  const vuote = conferimenti.filter((c) => (c.kg === undefined || c.kg === null) && !n0(c.svuotamenti) && !n0(c.pesoStrutture) && !n0(c.volumeStrutture) && !n0(c.pesoCdr) && !n0(c.volumeCdr)).length;
  if (vuote) avviso(`${vuote} righe della Banca Dati senza alcun conferimento.`);
  const tipSenzaRifiuto = new Set(conferimenti.map((c) => c.tipologia).filter((t) => !rifiuti.some((r) => r.tipologia === t)));
  if (rifiuti.length && tipSenzaRifiuto.size) avviso(`Tipologie conferite dalle utenze ma assenti nei rifiuti del territorio: ${elenco(tipSenzaRifiuto)}.`);

  // Peso misurato rispetto al totale del territorio (stima con i pesi specifici)
  const kgPer = {};
  conferimenti.forEach((c) => {
    const p = ps[c.tipologia] || 0;
    const kg = (n0(c.svuotamenti) * n0(c.volume) + n0(c.volumeStrutture) + n0(c.volumeCdr)) * p / 1000 + n0(c.pesoStrutture) + n0(c.pesoCdr) + n0(c.kg);
    kgPer[c.tipologia] = (kgPer[c.tipologia] || 0) + kg * (Number(c.nUtenze) || 1);
  });
  // Rilievo T23 (30/10/2026): se i rifiuti del passo 2 sono quelli di un
  // anno di riferimento diverso dall'anno monitorato (Standard 4.8.1), più
  // rifiuti di una frazione sono normali quando la raccolta cresce: si
  // avvisa solo oltre il +50% e lo si dice. Con lo stesso anno resta il
  // controllo del +10%.
  const riferimentoDiverso = annoRiferimento && anno && Number(annoRiferimento) !== Number(anno);
  for (const [t, kg] of Object.entries(kgPer)) {
    const tot = rifiuti.filter((r) => r.tipologia === t).reduce((s, r) => s + n0(r.qtot), 0) * 1000;
    const t1 = Math.round(kg / 1000).toLocaleString("it-IT");
    const t2 = Math.round(tot / 1000).toLocaleString("it-IT");
    if (riferimentoDiverso) {
      if (tot && kg > tot * 1.5) avviso(`«${t}»: i conferimenti delle utenze (${t1} t) superano di oltre il 50% i rifiuti dell'anno di riferimento ${annoRiferimento} (${t2} t, passo 2): normale solo se la raccolta di questa frazione è molto cresciuta, altrimenti verificate i dati.`);
    } else if (tot && kg > tot * 1.1) {
      avviso(`«${t}»: i conferimenti delle utenze (${t1} t) superano di oltre il 10% i rifiuti del territorio dello stesso anno (${t2} t, passo 2): verificate i dati o indicate nel passo 2 l'anno di riferimento da cui vengono i rifiuti.`);
    }
  }

  // Riuso
  const riusoSenzaUtenza = new Set(riuso.map((r) => r.utenza).filter((u) => !perUtenza.has(u)));
  if (riusoSenzaUtenza.size) avviso(`Utenze del riuso non presenti nella Banca Dati ${daUtenze ? "delle utenze (passo 5a)" : "dei conferimenti"}: ${elenco(riusoSenzaUtenza)}.`);

  return esiti;
}
