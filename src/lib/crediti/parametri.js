/* =========================================================================
   Parametri di default della Metodologia Carbon WastePrint® v1.2
   (Studio Associato Wastelab e Altraleonia S.r.l.).
   Tutti i valori sono modificabili nel singolo calcolo, come la Metodologia
   consente ("laddove differenti … in ogni progetto dovranno essere indicati
   i fattori di emissione e relative fonti").
   ========================================================================= */

// Tipologie di rifiuto "r" con il fattore di emissione per lo scenario
// "Riduzione" FErid(r) [kgCO₂eq/kg], usato come FEdes(r) nelle formule 13 e 25.
// Fonte: Tabella 3 (USEPA WARM 2019) e Tabella 4 (WRAP 2011).
// FErid_netto: Tabella 7, al netto della componente trasporto (da usare
// solo se il progetto calcola a parte i trasporti, Capitolo 9).
// ps: peso specifico di default [kg/m³], Tabella 8 (CREWSOD).
export const TIPOLOGIE_RIFIUTO = [
  { id: "organico", nome: "Frazione organica", fe: -3.66, feNetto: -3.66, ps: 250, recupero: true, fonte: "Tab. 3 – USEPA WARM 2019" },
  { id: "verde", nome: "Scarto verde", fe: -0.76, feNetto: -0.76, ps: null, recupero: true, soloDomestiche: true, fonte: "Tab. 3 – USEPA WARM 2019" },
  { id: "carta", nome: "Carta e cartone", fe: -6.07, feNetto: -6.07, ps: 33, recupero: true, fonte: "Tab. 3 – USEPA WARM 2019" },
  { id: "vetro", nome: "Vetro", fe: -0.53, feNetto: -0.53, ps: 150, recupero: true, fonte: "Tab. 3 – USEPA WARM 2019" },
  { id: "legno", nome: "Legno", fe: -2.11, feNetto: -2.11, ps: null, recupero: true, fonte: "Tab. 3 – USEPA WARM 2019" },
  { id: "plastica", nome: "Plastica", fe: -1.87, feNetto: -1.87, ps: 10, recupero: true, fonte: "Tab. 3 – USEPA WARM 2019" },
  { id: "metallo", nome: "Metallo", fe: null, feNetto: null, ps: 10, recupero: true, fonte: "da indicare nel Progetto" },
  { id: "inerti", nome: "Rifiuti inerti", fe: -0.11, feNetto: -0.11, ps: null, recupero: true, soloDomestiche: true, fonte: "Tab. 3 – USEPA WARM 2019" },
  { id: "tessili", nome: "Tessili", fe: -12.0, feNetto: -12.0, ps: null, recupero: true, fonte: "Tab. 4 – WRAP 2011" },
  { id: "raee", nome: "RAEE", fe: -4.87, feNetto: -4.87, ps: null, recupero: true, fonte: "Tab. 4 – WRAP 2011" },
  { id: "ingombranti", nome: "Ingombranti", fe: -0.98, feNetto: -0.98, ps: null, recupero: true, fonte: "Tab. 4 – WRAP 2011" },
  // Indifferenziato (EER 200301): fattore calcolato con le formule 16-17
  // come media pesata dei fattori delle frazioni a recupero.
  { id: "indifferenziato", nome: "Indifferenziato (EER 200301)", fe: null, feNetto: null, ps: 80, recupero: false, calcolato: true, fonte: "Formule 16-17" },
];

// Beni "b" destinati a riutilizzo: peso medio [kg] e FErid(b) [kgCO₂eq/kg].
// Fonte: Tabella 5 (WRAP 2011). Due scenari: centro riutilizzo / operatore
// dell'usato, oppure centro di preparazione per il riutilizzo.
export const BENI_RIUSO = [
  { id: "maglietta", nome: "Maglietta", peso: 0.25, feRiutilizzo: -12.8, fePreparazione: -11.1 },
  { id: "maglione", nome: "Maglione", peso: 0.5, feRiutilizzo: -9.22, fePreparazione: -8.02 },
  { id: "vestito", nome: "Vestito generico", peso: 0.4, feRiutilizzo: -12.0, fePreparazione: -7.51 },
  { id: "mobile", nome: "Mobile generico", peso: 30.0, feRiutilizzo: -0.98, fePreparazione: -1.25 },
  { id: "aee", nome: "AEE generici", peso: 15.5, feRiutilizzo: -4.87, fePreparazione: -3.29 },
];

// Buffer minimo per utenze monitorate (Tabella 15). Chiave: macrocategorie
// monitorate in ordine fisso res / nonres / und.
export const BUFFER_UTENZE = {
  "res+nonres+und": 0,
  "res+nonres": 10,
  "res+und": 5,
  "nonres+und": 20,
  res: 15,
  nonres: 30,
  und: 25,
};
export const BUFFER_CATEGORIA_UND_NON_MONITORATA = 0.5; // % per categoria
export const BUFFER_CATEGORIE_UND_MAX = 10; // %

// Buffer per utenze "solo virtuose" (Capitolo 7, default 20%).
export const BUFFER_SOLO_VIRTUOSE = 20;
// Tetto complessivo del buffer.
export const BUFFER_MASSIMO = 80;

// Giorni dell'anno (formula 1).
export const GIORNI_ANNO = 365;
