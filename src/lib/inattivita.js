/* =========================================================================
   inattivita.js — tempi dell'uscita automatica per inattività
   Scopo: un solo posto per i tempi usati da src/components/
     UscitaInattivita.jsx (richiesta di Luca del 20/10/2026, sicurezza).
     - Operatori e Amministratori: 30 minuti senza attività;
     - utenti degli enti: 60 minuti;
     - l'avviso «Sei ancora lì?» compare 2 minuti prima.
   Prove: test/inattivita.test.mjs. Solo costanti e calcoli.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */

export const TEMPO_STAFF_MIN = 30;
export const TEMPO_CLIENTI_MIN = 60;
export const AVVISO_MS = 2 * 60 * 1000;

// Millisecondi di inattività dopo i quali si esce, per ruolo.
export function msInattivita(ruolo) {
  const minuti = ruolo === "admin" || ruolo === "operatore" ? TEMPO_STAFF_MIN : TEMPO_CLIENTI_MIN;
  return minuti * 60 * 1000;
}
