/* =========================================================================
   Dati ufficiali del Programma Carbon WastePrint.
   Fonte: carbonwasteprint.com (fasi, soglie-giorno, ruoli).
   Usati in tutto il portale come riferimento unico.
   ========================================================================= */

// Le 6 fasi operative ufficiali, da Giorno 0 a Giorno 150.
export const FASI = [
  {
    n: 1,
    giorno: 0,
    titolo: "Richiesta di adesione e saldo fattura",
    responsabile: "Soggetto Promotore del Progetto",
    attore: "promotore",
    descr:
      "Il soggetto promotore presenta la richiesta di adesione al Programma CWP e provvede al saldo della fattura. Si apre la pratica.",
  },
  {
    n: 2,
    giorno: 10,
    titolo: "Conclusione prima fase di verifica documentale",
    responsabile: "Soggetto Promotore del Progetto",
    attore: "promotore",
    descr:
      "Completamento della prima verifica documentale: la modulistica e i documenti di progetto vengono controllati per ammissibilità.",
  },
  {
    n: 3,
    giorno: 40,
    titolo: "Chiusura del periodo di feedback pubblico (30 gg)",
    responsabile: "Soggetto Promotore del Progetto",
    attore: "promotore",
    descr:
      "Il progetto resta in consultazione pubblica per 30 giorni. Al Giorno 40 si chiude la finestra di feedback pubblico.",
  },
  {
    n: 4,
    giorno: 60,
    titolo: "Risposta ai commenti e pubblicazione documento",
    responsabile: "Soggetto Promotore del Progetto",
    attore: "promotore",
    descr:
      "Il promotore risponde ai commenti raccolti e pubblica il documento di progetto aggiornato.",
  },
  {
    n: 5,
    giorno: 135,
    titolo: "Chiusura validazione ed emissione rapporto",
    responsabile: "Ente di Validazione e Verifica",
    attore: "validatore",
    descr:
      "L'ente terzo di validazione e verifica (es. RINA) conclude la fase di validazione ed emette il rapporto di validazione.",
  },
  {
    n: 6,
    giorno: 150,
    titolo: "Conclusione seconda fase di verifica documentale",
    responsabile: "Soggetto Promotore del Progetto",
    attore: "promotore",
    descr:
      "Seconda e ultima verifica documentale. A esito positivo il progetto è validato: si procede al monitoraggio annuale e all'emissione dei crediti.",
  },
];

// I tre attori del Programma, con i relativi colori-guida.
export const ATTORI = {
  promotore: {
    label: "Soggetto Promotore del Progetto",
    short: "Promotore",
    sub: "Comune · Ente locale · Soggetto gestore",
    color: "#2f5d3a",
    soft: "#e4ede1",
  },
  operate: {
    label: "Fondazione Operate",
    short: "Operate",
    sub: "Soggetto Promotore del Programma",
    color: "#5a5e54",
    soft: "#e8e8e2",
  },
  validatore: {
    label: "Ente di Validazione e Verifica",
    short: "Validatore",
    sub: "RINA Services SpA · ISO 14064-2:2019",
    color: "#c98a1a",
    soft: "#f3e7d6",
  },
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
