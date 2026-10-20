/* =========================================================================
   csv.js — lettura e scrittura di file CSV (anche salvati da Excel in
   italiano, con separatore ";" e virgola decimale).

   Scopo: leggere i CSV caricati nel calcolo crediti (tabelle dati e file
   del tracciato), convertirli in oggetti secondo uno schema di colonne,
   produrre CSV da scaricare (export, modelli vuoti, registro crediti).

   Usato da: src/lib/crediti/tracciato.js, src/pages/CalcoloCrediti.jsx,
   src/components/crediti/TabellaDati.jsx,
   src/components/crediti/RegistroCrediti.jsx; test/csv.test.mjs.
   Dati/servizi coinvolti: nessuno (solo testo nel browser).

   Formato prodotto: separatore ";", fine riga CRLF, BOM UTF-8 iniziale
   (serve perché Excel riconosca le lettere accentate), numeri con la
   virgola decimale.

   Uso dei test: npm test (comprende test/csv.test.mjs).

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)»; capitolo 15
   «Calcolo crediti» (vedi anche docs/crediti-cwp.md).
   ========================================================================= */

// Divide il testo in righe e celle, gestendo le virgolette.
// Parametro: testo completo del file. Restituisce un array di righe, ognuna
// un array di celle (stringhe). Le righe tutte vuote vengono scartate.
// Il separatore si deduce dalla prima riga: ";" se compare almeno quante
// volte la ",", altrimenti ",". Dentro le virgolette "" vale come ".
export function leggiCsv(testo) {
  // Toglie l'eventuale BOM UTF-8 iniziale aggiunto da Excel.
  const pulito = testo.replace(/^﻿/, "");
  const primaRiga = pulito.split(/\r?\n/)[0] || "";
  const sep = (primaRiga.match(/;/g) || []).length >= (primaRiga.match(/,/g) || []).length ? ";" : ",";
  const righe = [];
  let riga = [];
  let cella = "";
  let virgolette = false;
  for (let i = 0; i < pulito.length; i++) {
    const ch = pulito[i];
    if (virgolette) {
      if (ch === '"' && pulito[i + 1] === '"') {
        cella += '"';
        i++;
      } else if (ch === '"') virgolette = false;
      else cella += ch;
    } else if (ch === '"') virgolette = true;
    else if (ch === sep) {
      riga.push(cella);
      cella = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && pulito[i + 1] === "\n") i++;
      riga.push(cella);
      if (riga.some((c) => c.trim() !== "")) righe.push(riga);
      riga = [];
      cella = "";
    } else cella += ch;
  }
  riga.push(cella);
  if (riga.some((c) => c.trim() !== "")) righe.push(riga);
  return righe;
}

// Normalizza un titolo di colonna per il confronto: minuscole, senza
// accenti, solo lettere e cifre ("Codice utenza" → "codiceutenza").
const normalizza = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");

/* Converte il CSV in oggetti secondo uno schema di colonne:
   schema = [{ chiave, titoli: ["Utenza", "codice utenza"], tipo: "numero"|"testo"|"si_no", obbligatorio, min }]
   Restituisce { righe, errori, erroriTotali, righeScartate, colonneMancanti }.
   - La prima riga è l'intestazione; ogni colonna si cerca fra i "titoli"
     ammessi (in qualsiasi ordine e maiuscolo/minuscolo).
   - Se manca una colonna obbligatoria non si legge nessuna riga.
   - min (solo numeri, facoltativo): valore minimo ammesso, es. 0 per pesi,
     volumi e svuotamenti (collaudo V01, D07: un peso negativo è un errore
     della riga, non un dato).
   - Una riga con errori viene scartata; errori contiene al massimo i primi
     20 messaggi, erroriTotali il numero complessivo, righeScartate il
     numero di righe scartate.
   - I numeri di riga nei messaggi sono quelli di Excel (intestazione = 1). */
export function csvInOggetti(testo, schema) {
  const righe = leggiCsv(testo);
  if (!righe.length) return { righe: [], errori: ["Il file è vuoto."], colonneMancanti: [] };
  const intestazione = righe[0].map(normalizza);
  const indici = {};
  const colonneMancanti = [];
  schema.forEach((col) => {
    const i = intestazione.findIndex((h) => col.titoli.some((t) => normalizza(t) === h));
    if (i >= 0) indici[col.chiave] = i;
    else if (col.obbligatorio) colonneMancanti.push(col.titoli[0]);
  });
  if (colonneMancanti.length) return { righe: [], errori: [], colonneMancanti };

  const errori = [];
  const oggetti = [];
  let scartate = 0;
  righe.slice(1).forEach((r, n) => {
    const o = {};
    let valida = true;
    schema.forEach((col) => {
      const i = indici[col.chiave];
      const grezzo = i === undefined ? "" : (r[i] || "").trim();
      if (col.tipo === "numero") {
        if (grezzo === "") o[col.chiave] = null;
        else {
          // "1.234,5" → 1234.5 ; "1234.5" → 1234.5
          const s = grezzo.includes(",") ? grezzo.replace(/\./g, "").replace(",", ".") : grezzo;
          const v = Number(s);
          if (!Number.isFinite(v)) {
            errori.push(`Riga ${n + 2}: «${grezzo}» non è un numero (${col.titoli[0]}).`);
            valida = false;
          } else if (col.min != null && v < col.min) {
            errori.push(`Riga ${n + 2}: «${grezzo}» non è ammesso (${col.titoli[0]}: il valore non può essere ${col.min === 0 ? "negativo" : `minore di ${col.min}`}).`);
            valida = false;
          }
          o[col.chiave] = v;
        }
      } else if (col.tipo === "si_no") {
        // Qualsiasi valore non riconosciuto come "sì" vale "no" (anche la cella vuota).
        o[col.chiave] = /^(si|sì|s|true|1|x|vero)$/i.test(grezzo);
      } else {
        o[col.chiave] = grezzo;
      }
      if (col.obbligatorio && (o[col.chiave] === "" || o[col.chiave] === null)) {
        errori.push(`Riga ${n + 2}: manca «${col.titoli[0]}».`);
        valida = false;
      }
    });
    if (valida) oggetti.push(o);
    else scartate++;
  });
  return { righe: oggetti, errori: errori.slice(0, 20), erroriTotali: errori.length, righeScartate: scartate, colonneMancanti: [] };
}

/* Protezione dalle formule nei fogli di calcolo (collaudo V01, D06;
   OWASP «CSV injection»). Un testo che inizia con = + - @ (o con
   tabulazione / a capo) verrebbe letto da Excel, LibreOffice o Google
   Sheets come una formula. Si antepone un apostrofo, che lo fa trattare
   come testo. Restano invariati i numeri veri (tipo number) e i testi che
   sono soltanto un numero, anche negativo («-3,66», «+5»): un foglio di
   calcolo li legge come numeri, non come formule, e il dato resta fedele.
   Parametro: valore già convertito in testo. Restituisce il testo sicuro.
   Usata da scriviCsv e dai CSV del fascicolo (src/lib/fascicolo.js) e del
   simulatore (src/lib/crediti/simulatore.js, righeCsv). */
export function testoSicuroCsv(s) {
  const t = String(s);
  if (!/^[=+\-@\t\r\n]/.test(t)) return t;
  if (/^[+-]?\d+([.,]\d+)?$/.test(t)) return t;
  return "'" + t;
}

// Crea un CSV (separatore ";") da intestazioni e righe.
// Parametri: intestazioni (array di testi), righe (array di array di valori).
// Restituisce il testo del file con BOM iniziale; i numeri usano la virgola
// decimale; le celle con ; " o a capo vanno tra virgolette; i testi che
// sembrano formule sono resi innocui (testoSicuroCsv).
export function scriviCsv(intestazioni, righe) {
  const cella = (v) => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : testoSicuroCsv(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [intestazioni.map(cella).join(";"), ...righe.map((r) => r.map(cella).join(";"))].join("\r\n");
}

// Fa scaricare un file di testo al browser.
// Parametri: nome del file, contenuto (testo), tipo MIME (predefinito CSV).
// Crea un collegamento temporaneo e lo "clicca"; l'indirizzo blob si libera
// dopo 5 secondi, quando il download è già partito.
export function scaricaTesto(nome, contenuto, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob([contenuto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
