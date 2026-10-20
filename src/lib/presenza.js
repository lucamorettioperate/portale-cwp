/* =========================================================================
   presenza.js — testi del pannello «Utenti online» (backlog 38)
   Scopo: trasformare i dati della presenza (script 32) in testi leggibili:
     nome della pagina aperta e da quanto tempo un utente è collegato.
   Usato da: src/components/UtentiOnline.jsx. Prove: test/presenza.test.mjs.
   Solo calcoli: nessun dato letto o scritto.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */

// Nomi leggibili delle pagine (indirizzo → nome nel menu).
const PAGINE = {
  "/": "Dashboard / Le mie pratiche",
  "/pratiche": "Pratiche",
  "/utenti": "Utenti",
  "/audit": "Audit",
  "/anagrafiche": "Anagrafiche",
  "/crediti": "Calcolo crediti",
  "/simulatore": "Simulatore",
  "/crediti-emessi": "Crediti emessi",
  "/reclami": "Reclami",
  "/impostazioni": "Impostazioni",
  "/documentazione": "Documentazione / Manuale",
  "/documenti": "I tuoi documenti",
  "/formato-dati": "Formato dati",
  "/profilo": "Il mio profilo",
  "/password": "Cambio password",
  "/programma": "Il Programma",
};

// Nome della pagina da un indirizzo: la voce più lunga che corrisponde
// (es. /crediti/123 → «Calcolo crediti»); altrimenti l'indirizzo stesso.
export function nomePagina(indirizzo) {
  if (!indirizzo) return "—";
  const percorso = String(indirizzo).split("?")[0];
  if (PAGINE[percorso]) return PAGINE[percorso];
  const voce = Object.keys(PAGINE)
    .filter((k) => k !== "/" && percorso.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return voce ? PAGINE[voce] : percorso;
}

// Durata leggibile tra un istante e adesso: «meno di un minuto», «12 min»,
// «2 h 5 min». Parametri: data ISO, adesso (millisecondi, per le prove).
export function durata(daIso, adesso = Date.now()) {
  const minuti = Math.max(0, Math.floor((adesso - new Date(daIso).getTime()) / 60000));
  if (minuti < 1) return "meno di un minuto";
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  return resto ? `${ore} h ${resto} min` : `${ore} h`;
}
