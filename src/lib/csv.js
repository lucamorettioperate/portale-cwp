/* Lettura e scrittura di file CSV (anche salvati da Excel in italiano,
   con separatore ";" e virgola decimale). */

// Divide il testo in righe e celle, gestendo le virgolette.
export function leggiCsv(testo) {
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

const normalizza = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");

/* Converte il CSV in oggetti secondo uno schema di colonne:
   schema = [{ chiave, titoli: ["Utenza", "codice utenza"], tipo: "numero"|"testo"|"si_no", obbligatorio }]
   Restituisce { righe, errori, colonneMancanti }. */
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
          }
          o[col.chiave] = v;
        }
      } else if (col.tipo === "si_no") {
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
  });
  return { righe: oggetti, errori: errori.slice(0, 20), erroriTotali: errori.length, colonneMancanti: [] };
}

// Crea un CSV (separatore ";") da intestazioni e righe.
export function scriviCsv(intestazioni, righe) {
  const cella = (v) => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [intestazioni.map(cella).join(";"), ...righe.map((r) => r.map(cella).join(";"))].join("\r\n");
}

// Fa scaricare un file di testo al browser.
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
