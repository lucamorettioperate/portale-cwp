/* =========================================================================
   cwpProgram.js — dati di riferimento del Programma Carbon WastePrint.

   Scopo: costanti condivise da tutto il portale, allineate all'analisi
   funzionale: le 7 fasi, i 3 ruoli applicativi, gli stati di pratica e di
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
export const FASI = [
  { numero: 1, nome: "Adesione", g_da: 0, g_a: 0, responsabile: "Soggetto Promotore" },
  { numero: 2, nome: "Prima verifica documentale", g_da: 0, g_a: 10, responsabile: "Soggetto Promotore" },
  { numero: 3, nome: "Consultazione pubblica", g_da: 10, g_a: 40, responsabile: "Soggetto Promotore" },
  { numero: 4, nome: "Risposta ai commenti / pubblicazione", g_da: 40, g_a: 60, responsabile: "Soggetto Promotore" },
  { numero: 5, nome: "Validazione e verifica", g_da: 60, g_a: 135, responsabile: "Ente di Validazione" },
  { numero: 6, nome: "Seconda verifica documentale", g_da: 135, g_a: 150, responsabile: "Soggetto Promotore" },
  { numero: 7, nome: "Chiusura", g_da: 150, g_a: 150, responsabile: "Soggetto Promotore" },
];

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
};

// Stati di una fase.
export const STATI_FASE = {
  non_iniziata: { label: "Non iniziata", bg: "#f0eee7", fg: "#8a8d82" },
  in_corso: { label: "In corso", bg: "#e4ede1", fg: "#2f5d3a" },
  in_attesa_integrazione: { label: "In attesa di integrazione", bg: "#f3e7d6", fg: "#c98a1a" },
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

// Tipologie di documento (requisiti §5, "I tuoi documenti").
// Nel database la colonna documento.tipologia è testo libero: questo
// elenco è la sola fonte delle voci proposte nel menu (Documenti.jsx).
export const TIPOLOGIE_DOCUMENTO = [
  "Contratto",
  "Allegato al contratto",
  "Documentazione amministrativa",
  "Documento di progetto",
  "Rapporto dell'Ente di Validazione",
  "Rapporto di calcolo dei crediti",
  "Integrazione",
  "Altro",
];
