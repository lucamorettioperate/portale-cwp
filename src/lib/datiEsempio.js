/* =========================================================================
   datiEsempio.js — dati di esempio del prototipo.

   Scopo: tre progetti fittizi a stadi diversi di avanzamento. Servivano
   finché il backend Supabase non era attivo; oggi le pratiche reali si
   leggono dal database (src/lib/dati.js).

   Usato da: nessun file importa più questo modulo (verificato con grep il
   18/10/2026). È un resto del prototipo: si può eliminare insieme ai
   componenti Timeline, AzioniRuolo, ProjectCard, Stat.
   Dati/servizi coinvolti: nessuno. I dati di prova del database stanno
   invece in supabase/03_dati_esempio.sql.

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)»
   (struttura del codice, resti del prototipo).
   ========================================================================= */

// Ogni voce: codice, nomi, tipo di soggetto, abitanti, fase e giorno
// correnti, adesione, periodo di accredito, % raccolta differenziata,
// tonnellate di rifiuti, crediti stimati ed emessi, stato del badge
// (vedi stato.js).
export const PROGETTI_ESEMPIO = [
  {
    id: "CWP-2025-014",
    nome: "Comune di Borgoval",
    promotore: "Comune di Borgoval",
    tipo: "Ente locale (T.U.E.L.)",
    abitanti: 18400,
    faseCorrente: 6,
    giornoCorrente: 150,
    aderito: "2025-06-02",
    periodo: "7 anni (rinnovabile ×3)",
    differenziata: 78.4,
    rifiutiTon: 9120,
    creditiStimati: 2840,
    creditiEmessi: 2840,
    stato: "Validato",
  },
  {
    id: "CWP-2025-021",
    nome: "Ambito Riviera Nord",
    promotore: "Ente di Governo ATO Riviera Nord",
    tipo: "Ente di Governo ATO",
    abitanti: 64200,
    faseCorrente: 4,
    giornoCorrente: 60,
    aderito: "2025-11-18",
    periodo: "10 anni (unica soluzione)",
    differenziata: 71.9,
    rifiutiTon: 31200,
    creditiStimati: 7150,
    creditiEmessi: 0,
    stato: "In istruttoria",
  },
  {
    id: "CWP-2026-003",
    nome: "AmbienteServizi SpA",
    promotore: "AmbienteServizi SpA (gestore pubblico)",
    tipo: "Soggetto gestore",
    abitanti: 42800,
    faseCorrente: 2,
    giornoCorrente: 10,
    aderito: "2026-04-09",
    periodo: "7 anni (rinnovabile ×3)",
    differenziata: 69.2,
    rifiutiTon: 21450,
    creditiStimati: 4980,
    creditiEmessi: 0,
    stato: "Adesione",
  },
];
