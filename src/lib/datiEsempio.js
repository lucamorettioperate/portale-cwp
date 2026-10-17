/* =========================================================================
   Dati di esempio — progetti a stadi diversi di avanzamento.
   Servono finché il backend Supabase non è attivo; poi verranno sostituiti
   dalle pratiche reali lette dal database.
   ========================================================================= */

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
