/* =========================================================================
   scadenze.js — regole dei riquadri «scadenze» della Dashboard
   (pagina Cruscotto.jsx), separate dalla pagina per poterle provare
   (test/rilievi_n.test.mjs).
   Ogni funzione riceve una riga di staff_cruscotto (script 09): stato
   della pratica, fase_stato e fase_scadenza della fase corrente,
   giorni_scadenza (calcolato dal database solo per fasi aperte con una
   data: negativo = scaduta).
   Rilievo N04 (22/10/2026): una fase aperta senza data non è «in regola»:
   è «senza scadenza nota» e si conta a parte, così lo zero di «In
   scadenza» e «Scadute» non sembra una garanzia. Le pratiche non attive
   (sospese, chiuse, annullate, ritirate) non entrano in nessuno dei tre.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */

// Una pratica è "in scadenza" se la fase aperta scade entro questi giorni.
export const SOGLIA_SCADENZA = 7;

const FASE_APERTA = ["in_corso", "in_attesa_integrazione"];

// Scade oggi o entro SOGLIA_SCADENZA giorni.
export function inScadenza(p) {
  return p.stato === "attiva" && p.giorni_scadenza != null && p.giorni_scadenza >= 0 && p.giorni_scadenza <= SOGLIA_SCADENZA;
}

// Scadenza già passata.
export function scaduta(p) {
  return p.stato === "attiva" && p.giorni_scadenza != null && p.giorni_scadenza < 0;
}

// Fase corrente aperta ma senza data di scadenza.
export function senzaScadenza(p) {
  return p.stato === "attiva" && FASE_APERTA.includes(p.fase_stato) && !p.fase_scadenza;
}
