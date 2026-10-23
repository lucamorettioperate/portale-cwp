/* =========================================================================
   cwpProgram.js — dati di riferimento del Programma Carbon WastePrint.

   Scopo: costanti condivise da tutto il portale, allineate all'analisi
   funzionale: le 7 fasi del Progetto e del Rapporto, i 3 ruoli applicativi, gli stati di pratica e di
   fase (con i colori dei badge), la palette e le tipologie di documento.

   Usato da: quasi tutte le pagine e i componenti (COLORI in particolare),
   src/App.jsx, src/lib/dati.js.
   Dati/servizi coinvolti: nessuna chiamata. Le chiavi di STATI_PRATICA,
   STATI_FASE e RUOLI devono coincidere con i tipi enumerati del database
   (stato_pratica, stato_fase, ruolo_utente in supabase/01_schema.sql):
   se si aggiunge un valore nel database va aggiunto anche qui.

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)»;
   capitolo 4 «Database» (tipi enumerati, tabella durata_fase).
   ========================================================================= */

// Le 7 fasi operative ufficiali (intervalli di giorni dall'infografica).
// g_da / g_a: giorno di inizio e fine indicativi dall'adesione.
// Sono valori descrittivi: le scadenze reali si calcolano nel database con
// la tabella durata_fase (13_durata_fasi.sql), modificabile dall'Admin.
// Responsabili con i nomi della Guida al Programma: la Fondazione è il
// «promotore del programma», il Comune (o chi presenta il progetto) il
// «promotore del progetto».
const PROG = "Promotore del progetto";
const PROGR = "Promotore del programma";
const ENTE = "Ente di validazione e verifica";

export const FASI = [
  { numero: 1, nome: "Adesione", g_da: 0, g_a: 0, responsabile: PROG },
  { numero: 2, nome: "Prima verifica documentale", g_da: 0, g_a: 10, responsabile: PROGR },
  { numero: 3, nome: "Feedback pubblico", g_da: 10, g_a: 40, responsabile: PROGR },
  { numero: 4, nome: "Risposta ai commenti / pubblicazione", g_da: 40, g_a: 60, responsabile: PROG },
  { numero: 5, nome: "Validazione e verifica", g_da: 60, g_a: 135, responsabile: ENTE },
  { numero: 6, nome: "Seconda verifica documentale", g_da: 135, g_a: 150, responsabile: PROGR },
  { numero: 7, nome: "Chiusura", g_da: 150, g_a: 150, responsabile: PROGR },
];

// Le 7 fasi di un Rapporto di Monitoraggio annuale (Guida al Programma
// 6.3.1 e Tabella 4; script 23): stesso percorso del Progetto con feedback
// pubblico di 20 giorni, risposta in 15, verifica dell'ente in 60 e
// seconda verifica documentale in 10.
export const FASI_RAPPORTO = [
  { numero: 1, nome: "Registrazione del rapporto", g_da: 0, g_a: 0, responsabile: PROG },
  { numero: 2, nome: "Prima verifica documentale", g_da: 0, g_a: 10, responsabile: PROGR },
  { numero: 3, nome: "Feedback pubblico", g_da: 10, g_a: 30, responsabile: PROGR },
  { numero: 4, nome: "Risposta ai commenti", g_da: 30, g_a: 45, responsabile: PROG },
  { numero: 5, nome: "Verifica del rapporto", g_da: 45, g_a: 105, responsabile: ENTE },
  { numero: 6, nome: "Seconda verifica documentale", g_da: 105, g_a: 115, responsabile: PROGR },
  { numero: 7, nome: "Chiusura", g_da: 115, g_a: 115, responsabile: PROGR },
];

// Fasi della verifica documentale, in cui la Fondazione può avviare la
// verifica sull'accuratezza e gli accertamenti (Guida 6.5.2, script 23).
export const FASI_VERIFICA_DOCUMENTALE = [2, 6];

export const fasiDi = (tipo) => (tipo === "rapporto" ? FASI_RAPPORTO : FASI);

// Nomi dei tipi di pratica, per elenchi e menu.
export const TIPI_PRATICA = { progetto: "Progetto", rapporto: "Rapporto di Monitoraggio" };

// I tre ruoli applicativi (chiavi = valori di profilo.ruolo).
// label/short/sub: testi mostrati; color/soft: colori del badge.
export const RUOLI = {
  cliente: {
    label: "Cliente / Organizzazione",
    short: "Cliente",
    sub: "Comune · Ente locale · Soggetto gestore",
    color: "#2f5d3a",
    soft: "#e4ede1",
  },
  operatore: {
    label: "Operatore di back-office",
    short: "Operatore",
    sub: "Fondazione Operate",
    color: "#5a5e54",
    soft: "#e8e8e2",
  },
  admin: {
    label: "Amministratore",
    short: "Admin",
    sub: "Configurazione e gestione",
    color: "#b06a2f",
    soft: "#f3e7d6",
  },
};

// Stati di una pratica (Progetto o Rapporto).
export const STATI_PRATICA = {
  attiva: { label: "Attiva", bg: "#e4ede1", fg: "#2f5d3a" },
  sospesa: { label: "Sospesa", bg: "#f3e7d6", fg: "#c98a1a" },
  annullata: { label: "Annullata", bg: "#f6dcd6", fg: "#a23b2c" },
  chiusa: { label: "Chiusa", bg: "#e8e8e2", fg: "#5a5e54" },
  // Progetto ritirato su richiesta del promotore (Guida 6.4.1, script 22):
  // resta pubblico, non emette crediti, può rientrare («Riattiva»).
  ritirata: { label: "Ritirato", bg: "#efe3e0", fg: "#7a4a3f" },
};

// Periodo di riferimento del Progetto (Standard 4.3.8) e numero massimo
// di Rapporti annuali (lo stesso limite è nel database, script 23).
export const PERIODI_RIFERIMENTO = {
  "10 anni": { label: "10 anni (una volta)", rapporti: 10 },
  "7 anni rinnovabili": { label: "7 anni rinnovabili 3 volte", rapporti: 21 },
};

// Stato della pratica nel Programma, con i nomi della Guida (Tabelle 3 e
// 4). Stesso calcolo di cwp_stato_programma nel database (script 23).
// Parametri: pratica (con stato e tipo) e le sue fasi.
export function statoProgramma(pratica, fasi = []) {
  if (!pratica) return "";
  if (pratica.stato === "ritirata") return "progetto ritirato";
  if (pratica.stato === "annullata") return "non registrato (pratica annullata)";
  const fatte = new Set(fasi.filter((f) => f.stato === "completata").map((f) => f.numero));
  const rapporto = pratica.tipo === "rapporto";
  if (fatte.has(6)) return rapporto ? "rapporto registrato e crediti registrati" : "progetto registrato";
  if (fatte.has(5)) return "in fase di verifica documentale";
  if (fatte.has(2)) return "in fase di validazione";
  return rapporto ? "richiesta di registrazione del rapporto" : "richiesta di registrazione";
}

// Voci dei pagamenti (colonna pagamento.voce, script 23), dallo Schema
// tariffario: la tariffa di iscrizione va saldata prima della fase 5.
export const VOCI_PAGAMENTO = {
  iscrizione: "Tariffa di iscrizione",
  registrazione: "Tariffa di registrazione",
  emissione: "Emissione dei crediti",
  vendita: "Vendita dei crediti",
  altro: "Altro",
};

// Stati di una fase.
// Colori della scritta dello stato di una fase (richiesta di Luca Moretti
// del 23/10/2026): VERDE completata, ARANCIO in corso (e in attesa di
// integrazione, che è una fase ancora aperta), ROSSO non iniziata. Usati
// dal badge della fase nella pratica (DettaglioPratica) e dalla colonna
// «Fase corrente» della Dashboard (Cruscotto).
export const STATI_FASE = {
  non_iniziata: { label: "Non iniziata", bg: "#f8e3df", fg: "#a23b2c" },
  in_corso: { label: "In corso", bg: "#fbe8d4", fg: "#b95a0b" },
  in_attesa_integrazione: { label: "In attesa di integrazione", bg: "#fbe8d4", fg: "#b95a0b" },
  completata: { label: "Completata", bg: "#dfe9db", fg: "#2f5d3a" },
};

// Palette condivisa del portale.
export const COLORI = {
  ink: "#1b2118",
  paper: "#f6f4ee",
  paperWarm: "#efece1",
  line: "#d9d4c5",
  green: "#2f5d3a",
  greenSoft: "#e4ede1",
  ocra: "#b06a2f",
  ocraSoft: "#f3e7d6",
  grafite: "#5a5e54",
  white: "#ffffff",
  amber: "#c98a1a",
  red: "#a23b2c",
};

// Tipologie di documento: i nomi ufficiali della Guida al Programma
// (cap. 6.2.4, 6.3.1, 6.3.3, 6.4.1, 7) e i documenti di lavoro del portale.
// Nel database la colonna documento.tipologia è testo libero: questo
// elenco è la sola fonte delle voci proposte nel menu (Documenti.jsx).
export const TIPOLOGIE_DOCUMENTO = [
  "Modulo di descrizione del progetto",
  "Modulo di descrizione del progetto – versione privata",
  "Documento di proprietà del progetto",
  "Contratto con l'ente di validazione e verifica",
  "Documento riassuntivo delle risultanze del periodo di feedback pubblico",
  "Rapporto di validazione",
  "Modulo di descrizione del rapporto di monitoraggio",
  "Rapporto di verifica",
  "Dichiarazione relativa all'effettività della generazione dei crediti",
  "Modulo di delega di rappresentanza",
  "Modulo di adesione a un progetto",
  "Modulo di recesso da un progetto",
  "Richiesta di ritiro o di rientro del progetto",
  "Prova di attività del progetto",
  "Comunicazione di vendita dei crediti",
  "Dichiarazione di cancellazione tombale dei crediti",
  "Documentazione amministrativa",
  "Rapporto di calcolo dei crediti",
  "Integrazione",
  "Altro",
];

// Tipologie mai pubbliche (Guida 7.1 e 7.3): lo stesso controllo è nel
// database (cwp_tipologia_riservata, script 23).
export const tipologiaRiservata = (t) => /^contratto con l'ente/i.test(t || "") || /versione privata/i.test(t || "");
