/* =========================================================================
   codiciFiscali.js — controllo di codice fiscale e partita IVA
   (rilievo T08 del 29/10/2026).

   Scopo: dire se un codice fiscale (11 cifre per enti e società, 16
   caratteri per le persone) o una partita IVA (11 cifre) sono scritti
   correttamente, cifra o carattere di controllo compresi. Le stesse regole
   sono nel database (cwp_cf_valido, cwp_piva_valida, script 48), che
   rifiuta i dati sbagliati: qui servono per avvisare prima di salvare.
   Usato da: src/pages/Anagrafiche.jsx. Prove: test/rilievi_t.test.mjs.
   Registro sviluppo e deploy: cronologia del 30/10/2026.
   ========================================================================= */

// Partita IVA: 11 cifre; cifra di controllo = (10 − somma) mod 10, con le
// cifre in posizione pari raddoppiate (meno 9 se superano 9).
export function pivaValida(v) {
  const p = String(v || "").replace(/\s/g, "").replace(/^IT/i, "");
  if (!/^\d{11}$/.test(p)) return false;
  let s = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(p[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    s += d;
  }
  return (10 - (s % 10)) % 10 === Number(p[10]);
}

const DISPARI = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];

// Codice fiscale: 11 cifre (come la partita IVA) o 16 caratteri con il
// carattere di controllo (anche con le lettere dell'omocodia).
export function cfValido(v) {
  const c = String(v || "").replace(/\s/g, "").toUpperCase();
  if (/^\d{11}$/.test(c)) return pivaValida(c);
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 15; i++) {
    const ch = c[i];
    const k = /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65;
    s += i % 2 === 0 ? DISPARI[k] : k;
  }
  return String.fromCharCode(65 + (s % 26)) === c[15];
}

// Messaggi per il modulo dell'organizzazione (campi vuoti ammessi).
export function erroriDatiFiscali({ codice_fiscale, partita_iva }) {
  const e = [];
  if (String(codice_fiscale || "").trim() && !cfValido(codice_fiscale)) {
    e.push("Codice fiscale non valido: 11 cifre per enti e società, 16 caratteri per le persone, con il carattere di controllo corretto.");
  }
  if (String(partita_iva || "").trim() && !pivaValida(partita_iva)) {
    e.push("Partita IVA non valida: 11 cifre con la cifra di controllo corretta.");
  }
  return e;
}
