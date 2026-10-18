/* =========================================================================
   date.js — utilità per le date mostrate nel portale (formato italiano).

   Scopo: formattare le date del database (gg/mm/aaaa), contare i giorni
   alle scadenze e ottenere la data di oggi in formato ISO.

   Usato da: pagine Cruscotto, CalcoloCrediti, Crediti, TuoiDocumenti,
   ConsultazioniPubbliche; componenti DettaglioPratica, Consultazione,
   Integrazioni, Notifiche, Pagamenti, crediti/ImportaTracciato,
   crediti/RegistroCrediti.
   Dati/servizi coinvolti: nessuno.

   Nota: una data "solo giorno" (aaaa-mm-gg) va letta come mezzanotte
   locale. new Date("2026-10-17") la leggerebbe in UTC e in Italia
   potrebbe mostrare il giorno sbagliato: per questo si aggiunge T00:00:00.

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)».
   ========================================================================= */

// "2026-10-17" o un timestamp → "17/10/2026"
// Parametro: data ISO (aaaa-mm-gg), timestamp o oggetto Date.
// Restituisce il testo formattato oppure "—" se il valore manca o non è valido.
export function formatoData(valore) {
  if (!valore) return "—";
  // Stringa di 10 caratteri = data senza ora: si legge in ora locale.
  const d = typeof valore === "string" && valore.length === 10 ? new Date(valore + "T00:00:00") : new Date(valore);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Giorni che mancano a una data (negativo se già passata).
// Parametro: data ISO aaaa-mm-gg. Restituisce un intero oppure null.
// Si confrontano due mezzanotti locali; Math.round assorbe l'ora in più o
// in meno dei giorni di cambio dell'ora legale.
export function giorniA(dataIso) {
  if (!dataIso) return null;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const d = new Date(dataIso + "T00:00:00");
  return Math.round((d - oggi) / (24 * 60 * 60 * 1000));
}

// Oggi in formato ISO (aaaa-mm-gg), ora locale.
// Non si usa toISOString(), che darebbe la data UTC (sbagliata dopo la
// mezzanotte italiana fino alle 01:00/02:00).
export function oggiIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
