/* =========================================================================
   simulatorePdf.js — stampa impaginata (PDF) di uno scenario del simulatore
   Scopo (backlog 37, 20/10/2026): un PDF in A4 orizzontale da consegnare o
     presentare a un Comune: intestazione con i loghi, scheda dello
     scenario, avvertenza «stima ex ante», indicatori di sintesi, crediti
     anno per anno, parte economica, costi del Caso 1 o 2, note e avvisi,
     numeri di pagina. Prende le tabelle da contenutoSimulazione()
     (src/lib/crediti/simulatoreExport.js), le stesse del file Excel.
   Usato da: src/pages/Simulatore.jsx («Scarica PDF»), con import dinamico:
     jsPDF si scarica solo quando serve.
   Nessun dato letto o scritto nel database; i loghi si leggono da
     public/loghi/ (se mancano il PDF esce senza loghi).
   Caratteri: il font standard «helvetica» copre solo Latin-1, quindi ogni
     testo passa da pdfTesto() (CO₂ → CO2, ® resta, simboli tolti).
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti» (simulatore).
   ========================================================================= */
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

// Colori RGB, uguali alla palette del portale e al rapporto di calcolo.
const VERDE = [47, 93, 58];
const VERDE_CHIARO = [228, 237, 225];
const INK = [27, 33, 24];
const GRAFITE = [90, 94, 84];
const LINEA = [217, 212, 197];
const OCRA = [176, 106, 47];
const OCRA_CHIARO = [246, 234, 220];

// Testo stampabile con i font standard del PDF (vedi rapportoPdf.js).
const pdfTesto = (s) =>
  String(s ?? "")
    .replace(/₂/g, "2").replace(/₃/g, "3").replace(/≤/g, "<=").replace(/≥/g, ">=")
    .replace(/[−–]/g, "-").replace(/×/g, "x").replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xFF€—…·•]/g, "");

// Numero in formato italiano con d decimali; "—" se manca.
const num = (v, d = 1) =>
  v == null || v === "" || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

// Logo come immagine (null se non disponibile): { dataUrl, w, h }.
async function immagine(url) {
  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = ko;
      r.readAsDataURL(blob);
    });
    const dim = await new Promise((ok) => {
      const img = new Image();
      img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => ok(null);
      img.src = dataUrl;
    });
    return dim ? { dataUrl, ...dim } : null;
  } catch {
    return null;
  }
}

// Decimali per unità di misura degli indicatori di sintesi.
function valoreSintesi(v, unita) {
  if (v == null) return "—";
  if (unita === "") return String(v);
  if (unita === "€") return `${num(v, 0)} €`;
  if (unita === "tCO2eq/ab/anno") return `${num(v, 3)} ${unita}`;
  if (unita === "€/credito" || unita === "€/ab") return `${num(v, 2)} ${unita}`;
  if (unita === "%") return `${num(v, 1)}%`;
  return `${num(v, 1)} ${unita}`;
}

/* Genera il PDF. Parametri: contenuto (da contenutoSimulazione), nomeFile.
   Restituisce { blob, nomeFile }. Coordinate in millimetri su A4
   orizzontale (297 × 210); "y" avanza a ogni blocco. */
export async function generaPdfSimulazione(contenuto, nomeFile) {
  const c = contenuto;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const base = {
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.8, cellPadding: 1.4, textColor: INK, lineColor: LINEA, lineWidth: 0.15 },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold", valign: "middle" },
    alternateRowStyles: { fillColor: [250, 249, 245] },
    margin: { left: M, right: M, top: 20, bottom: 16 },
  };
  let y = 0;
  const tabella = (opzioni) => {
    if (y > H - 45) { doc.addPage(); y = 22; }
    autoTable(doc, { ...base, ...opzioni, startY: y });
    y = doc.lastAutoTable.finalY;
  };
  const titolo = (t) => {
    if (y > H - 40) { doc.addPage(); y = 22; }
    doc.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(...VERDE).text(pdfTesto(t), M, y);
    doc.setDrawColor(...LINEA).setLineWidth(0.3).line(M, y + 1.8, W - M, y + 1.8);
    y += 6.5;
  };
  const paragrafo = (t, colore = GRAFITE, dimensione = 8.2) => {
    doc.setFont("helvetica", "normal").setFontSize(dimensione).setTextColor(...colore);
    const righe = doc.splitTextToSize(pdfTesto(t), W - 2 * M);
    if (y + righe.length * 3.8 > H - 16) { doc.addPage(); y = 22; }
    doc.text(righe, M, y);
    y += righe.length * 3.8 + 1.5;
  };

  // ---------- Intestazione ----------
  const [logoCwp, logoFo] = await Promise.all([immagine("/loghi/carbonwasteprint.png"), immagine("/loghi/fondazione-operate.png")]);
  if (logoCwp) doc.addImage(logoCwp.dataUrl, "PNG", M, 8, (logoCwp.w / logoCwp.h) * 16, 16);
  if (logoFo) {
    const w = (logoFo.w / logoFo.h) * 9;
    doc.addImage(logoFo.dataUrl, "PNG", W - M - w, 12, w, 9);
  }
  doc.setDrawColor(...VERDE).setLineWidth(0.6).line(M, 28, W - M, 28);
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...VERDE);
  doc.text(pdfTesto(c.titolo), M, 37);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...GRAFITE);
  doc.text(pdfTesto(c.sottotitolo), M, 43);
  y = 48;

  // Avvertenza in un riquadro ocra.
  doc.setFont("helvetica", "normal").setFontSize(8.2);
  const avv = doc.splitTextToSize(pdfTesto(c.avvertenza), W - 2 * M - 8);
  doc.setFillColor(...OCRA_CHIARO).setDrawColor(...OCRA).setLineWidth(0.3);
  doc.roundedRect(M, y, W - 2 * M, avv.length * 3.8 + 4, 1.5, 1.5, "FD");
  doc.setTextColor(...OCRA).text(avv, M + 4, y + 4.6);
  y += avv.length * 3.8 + 8;

  // ---------- Scheda e sintesi affiancate ----------
  const yInizio = y;
  const meta = (W - 2 * M - 6) / 2;
  autoTable(doc, {
    ...base,
    startY: yInizio,
    margin: { ...base.margin, right: M + meta + 6 },
    head: [["Scenario", ""]],
    body: c.scheda.map(([k, v]) => [pdfTesto(k), pdfTesto(v)]),
    columnStyles: { 0: { cellWidth: 38, fontStyle: "bold", fillColor: VERDE_CHIARO } },
  });
  const yScheda = doc.lastAutoTable.finalY;
  autoTable(doc, {
    ...base,
    startY: yInizio,
    margin: { ...base.margin, left: M + meta + 6 },
    head: [["Indicatori di sintesi", ""]],
    body: c.sintesi.map(([k, v, u]) => [pdfTesto(k), pdfTesto(valoreSintesi(v, u))]),
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });
  y = Math.max(yScheda, doc.lastAutoTable.finalY) + 8;

  // ---------- Crediti anno per anno ----------
  titolo("Crediti stimati anno per anno");
  const interi = new Set([0, 1]);
  tabella({
    head: [c.anni.colonne.map(pdfTesto)],
    body: c.anni.righe.map((r) => r.map((v, i) => (i === 0 ? String(v) : interi.has(i) ? num(v, 0) : num(v, 1)))),
    styles: { ...base.styles, fontSize: 7.3, halign: "right" },
    headStyles: { ...base.headStyles, halign: "center", fontSize: 7 },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
  });
  y += 7;

  // ---------- Parte economica ----------
  if (c.economia) {
    titolo("Simulazione economica (importi IVA esclusa)");
    tabella({
      head: [c.economia.colonne.map(pdfTesto)],
      body: c.economia.righe.map((r) => r.map((v, i) => (i === 0 ? String(v) : i === 2 ? num(v, 2) : num(v, 0)))),
      foot: [c.economia.totali.map((v, i) => (i === 0 ? "Totale" : v == null ? "" : i === 2 ? num(v, 2) : num(v, 0)))],
      styles: { ...base.styles, fontSize: 7.3, halign: "right" },
      headStyles: { ...base.headStyles, halign: "center", fontSize: 7 },
      footStyles: { fillColor: VERDE_CHIARO, textColor: INK, fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    });
    y += 7;
  }

  // ---------- Costi del Caso 1 o 2 ----------
  if (c.costi) {
    titolo(`Costi annui del Programma — ${c.costi.listino}`);
    tabella({
      head: [["Voce", "Tipo", "€/abitante/anno", "€/anno"].map(pdfTesto)],
      body: c.costi.righe.map(([v, t, u, imp]) => [pdfTesto(v), t, num(u, 2), num(imp, 0)]),
      tableWidth: 170,
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
    });
    y += 6;
    paragrafo("Tabelle «Costi per il Soggetto Promotore» di Fondazione Operate (28/07/2026), progetti di 10 anni; le voci una tantum sono già ammortizzate sui 10 anni. Non comprendono la validazione dell'ente.");
    y += 3;
  }

  // ---------- Note e avvisi ----------
  if (c.note) {
    titolo("Note dello scenario");
    paragrafo(c.note, INK);
    y += 2;
  }
  if (c.avvisi.length) {
    titolo("Avvisi del simulatore");
    c.avvisi.forEach((a) => paragrafo(`•  ${a}`, INK));
  }

  // ---------- Intestazione ripetuta e piè di pagina ----------
  const pagine = doc.getNumberOfPages();
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRAFITE);
      doc.text(pdfTesto(`${c.titolo} · ${c.sottotitolo}`), M, 11);
      doc.setDrawColor(...LINEA).setLineWidth(0.2).line(M, 13, W - M, 13);
    }
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRAFITE);
    doc.text(pdfTesto("Fondazione Operate · Portale Carbon WastePrint · stima ex ante non certificabile"), M, H - 7);
    doc.text(`Pagina ${i} di ${pagine}`, W - M, H - 7, { align: "right" });
  }
  return { blob: doc.output("blob"), nomeFile };
}
