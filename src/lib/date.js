/* =========================================================================
   date.js — utilità per le date mostrate nel portale (formato italiano).

   Scopo: formattare le date del database (gg/mm/aaaa), contare i giorni
   alle scadenze e ottenere la data di oggi in formato ISO (anche la data
   italiana, indipendente dal fuso del computer).

   Usato da: src/lib/fascicolo.js e crediti/RegistroCrediti (nomi dei file
   con la data italiana); pagine Cruscotto, CalcoloCrediti, Crediti, TuoiDocumenti,
   ConsultazioniPubbliche; componenti DettaglioPratica, Consultazione,
   Integrazioni, Notifiche, Pagamenti, crediti/ImportaTracciato,
   crediti/RegistroCrediti.
   Dati/servizi coinvolti: nessuno.

   Nota: una data "solo giorno" (aaaa-mm-gg) va letta come mezzanotte
   locale. new Date("2026-10-17") la leggerebbe in UTC e in Italia
   potrebbe mostrare il giorno sbagliato: per questo si aggiunge T00:00:00.

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)».
   ========================================================================= */

// true se "aaaa-mm-gg" è un giorno che esiste nel calendario (il 29/02 solo
// negli anni bisestili). new Date("2025-02-31") darebbe il 3 marzo: questo
// controllo lo impedisce (collaudo V01, D04). Usata da formatoData e giorniA.
export function dataIsoEsiste(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// "2026-10-17" o un timestamp → "17/10/2026"
// Parametro: data ISO (aaaa-mm-gg), timestamp o oggetto Date.
// Restituisce il testo formattato oppure "—" se il valore manca o non è valido.
export function formatoData(valore) {
  if (!valore) return "—";
  // Una data aaaa-mm-gg inesistente (es. 2025-02-31) non si «sposta» al
  // mese dopo: si mostra «—» (collaudo V01, D04).
  if (typeof valore === "string" && valore.length === 10 && !dataIsoEsiste(valore)) return "—";
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
  if (!dataIso || !dataIsoEsiste(dataIso)) return null;
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

// Oggi in Italia (fuso Europe/Rome) in formato aaaa-mm-gg, qualunque sia il
// fuso del computer che usa il portale. È lo stesso «oggi» del database
// (20_rinforzi_integrita.sql) e della funzione consultazione-pubblica.
// Il formato svedese (sv-SE) produce già aaaa-mm-gg.
export function oggiItalia() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Aggiunge n giorni a una data aaaa-mm-gg e restituisce aaaa-mm-gg.
// Calcolo sul calendario (in UTC, senza ore), quindi indifferente all'ora
// legale: aggiungiGiorni("2026-10-18", 30) → "2026-11-17".
export function aggiungiGiorni(dataIso, n) {
  const [a, m, g] = dataIso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, g + n)).toISOString().slice(0, 10);
}
