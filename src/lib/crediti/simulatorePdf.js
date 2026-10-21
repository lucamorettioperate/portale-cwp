/* =========================================================================
   simulatorePdf.js — stampa impaginata (PDF) di uno scenario del simulatore
   Scopo (backlog 37, 20/10/2026): un PDF in A4 orizzontale da consegnare o
     presentare a un Comune: intestazione con i loghi, scheda dello
     scenario, avvertenza «stima ex ante», indicatori di sintesi, grafici,
     e poi TUTTI i dati della pagina sezione per sezione (dal 21/10/2026):
     1. impostazioni e buffer del Capitolo 7; 2. scenario di riferimento
     con i rifiuti per tipologia; situazione attuale; 3. obiettivi anno per
     anno; 4. risultati con il totale; 5. parametri economici, costi del
     Caso 1 o 2 e ricavi/costi/margine anno per anno; note e avvisi;
     numeri di pagina. Prende le tabelle da contenutoSimulazione()
     (src/lib/crediti/simulatoreExport.js), le stesse del file Excel.
   Usato da: src/pages/Simulatore.jsx («Scarica PDF»), con import dinamico:
     jsPDF si scarica solo quando serve.
   Nessun dato letto o scritto nel database; i loghi si leggono da
     public/loghi/ (se mancano il PDF esce senza loghi).
   Caratteri: dal 21/10/2026 il PDF incorpora Liberation Sans
     (caratteriPdf.js, rilievo R08); se non si scarica si usa Helvetica.
     Ogni testo passa comunque da pdfTesto() (CO₂ → CO2, ® resta, simboli
     tolti), così il testo è identico nei due casi.
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti» (simulatore).
   ========================================================================= */
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { caratteriPdf } from "../caratteriPdf.js";

// Colori RGB, uguali alla palette del portale e al rapporto di calcolo.
const VERDE = [47, 93, 58];
const VERDE_CHIARO = [228, 237, 225];
const INK = [27, 33, 24];
const GRAFITE = [90, 94, 84];
const LINEA = [217, 212, 197];
const OCRA = [176, 106, 47];
const OCRA_CHIARO = [246, 234, 220];
const ROSSO = [178, 58, 46];

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

// Tacche «tonde» dell'asse (1, 2, 2,5 o 5 × 10^n) da min a max.
function tacche(min, max, quante = 4) {
  const ampiezza = max - min || Math.abs(max) || 1;
  const grezzo = ampiezza / quante;
  const p = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= grezzo) || 10 * p;
  const da = Math.floor(min / passo) * passo;
  const a = Math.ceil(max / passo) * passo;
  const out = [];
  for (let v = da; v <= a + passo / 2; v += passo) out.push(Math.round(v / passo) * passo);
  return out;
}

/* Disegna un grafico (dal 21/10/2026, richiesta di Luca: «con costi e
   grafici») con le primitive di jsPDF, senza immagini: resta nitido a
   ogni ingrandimento. g = { titolo, tipo: "barre"|"linea", etichette,
   valori, decimali, unita?, soglia? }; x, y, w, h in mm (riquadro).
   Barre: verdi se positive, rosse se negative, con il valore sopra se gli
   anni sono al massimo 12. Linea: punti con il valore e, se indicata, la
   linea tratteggiata della soglia (65% di differenziata, zero del
   margine cumulato). */
function grafico(doc, FONT, g, x, y, w, h) {
  const valori = g.valori.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
  const fmt = (v) => `${num(v, g.decimali ?? 0)}${g.unita || ""}`;
  // Riquadro e titolo.
  doc.setDrawColor(...LINEA).setLineWidth(0.25).setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setFont(FONT, "bold").setFontSize(8.5).setTextColor(...INK).text(pdfTesto(g.titolo), x + 3, y + 5);
  // Area del disegno.
  const sx = x + 18, dx = x + w - 4, sy = y + 10, gy = y + h - 8;
  let min = Math.min(...valori, g.tipo === "barre" ? 0 : Infinity);
  let max = Math.max(...valori, g.tipo === "barre" ? 0 : -Infinity);
  if (g.soglia != null) { min = Math.min(min, g.soglia); max = Math.max(max, g.soglia); }
  if (g.tipo === "linea" && g.unita === "%") { min = Math.max(0, min - 5); max = Math.min(100, max + 5); }
  const assi = tacche(min, max);
  const lo = assi[0], hi = assi[assi.length - 1];
  const scala = (v) => gy - ((v - lo) / (hi - lo || 1)) * (gy - sy);
  doc.setFont(FONT, "normal").setFontSize(6.3).setTextColor(...GRAFITE);
  assi.forEach((v) => {
    doc.setDrawColor(...(v === 0 ? GRAFITE : LINEA)).setLineWidth(v === 0 ? 0.3 : 0.15).line(sx, scala(v), dx, scala(v));
    doc.text(pdfTesto(fmt(v)), sx - 1.5, scala(v) + 1.1, { align: "right" });
  });
  const n = valori.length;
  const passo = (dx - sx) / Math.max(n, 1);
  const ogni = n > 12 ? 3 : 1;
  const conValori = n <= 12;
  const cx = (i) => sx + i * passo + passo / 2;
  g.etichette.forEach((e, i) => {
    if (i % ogni === 0) doc.setFont(FONT, "normal").setFontSize(6.3).setTextColor(...GRAFITE).text(String(e), cx(i), gy + 4, { align: "center" });
  });
  if (g.tipo === "barre") {
    const larg = Math.max(1.2, Math.min(9, passo * 0.62));
    const y0 = scala(0);
    valori.forEach((v, i) => {
      const yv = scala(v);
      doc.setFillColor(...(v >= 0 ? VERDE : ROSSO));
      if (Math.abs(yv - y0) > 0.05) doc.rect(cx(i) - larg / 2, Math.min(yv, y0), larg, Math.abs(yv - y0), "F");
      if (conValori) {
        doc.setFont(FONT, "normal").setFontSize(5.6).setTextColor(...INK);
        doc.text(pdfTesto(num(v, g.decimali ?? 0)), cx(i), v >= 0 ? yv - 1 : yv + 2.6, { align: "center" });
      }
    });
  } else {
    if (g.soglia != null) {
      doc.setDrawColor(...OCRA).setLineWidth(0.35).setLineDashPattern([1.2, 1.2], 0);
      doc.line(sx, scala(g.soglia), dx, scala(g.soglia));
      doc.setLineDashPattern([], 0);
      doc.setFont(FONT, "normal").setFontSize(6).setTextColor(...OCRA);
      doc.text(pdfTesto(g.unita === "%" ? `soglia ${fmt(g.soglia)}` : "pareggio"), dx, scala(g.soglia) - 1, { align: "right" });
    }
    doc.setDrawColor(...VERDE).setLineWidth(0.5);
    for (let i = 1; i < n; i++) doc.line(cx(i - 1), scala(valori[i - 1]), cx(i), scala(valori[i]));
    valori.forEach((v, i) => {
      doc.setFillColor(...(v >= (g.unita === "%" ? -Infinity : 0) ? VERDE : ROSSO)).circle(cx(i), scala(v), 0.8, "F");
      if (conValori) {
        doc.setFont(FONT, "normal").setFontSize(5.6).setTextColor(...INK);
        doc.text(pdfTesto(num(v, g.decimali ?? 0)), cx(i), scala(v) - 1.6, { align: "center" });
      }
    });
  }
}

/* Genera il PDF. Parametri: contenuto (da contenutoSimulazione), nomeFile.
   Restituisce { blob, nomeFile }. Coordinate in millimetri su A4
   orizzontale (297 × 210); "y" avanza a ogni blocco. */
export async function generaPdfSimulazione(contenuto, nomeFile) {
  const c = contenuto;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  // Carattere incorporato (R08): stessa resa in ogni lettore PDF.
  const FONT = await caratteriPdf(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const base = {
    theme: "grid",
    styles: { font: FONT, fontSize: 7.8, cellPadding: 1.4, textColor: INK, lineColor: LINEA, lineWidth: 0.15 },
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
    // Un titolo non resta da solo in fondo alla pagina.
    if (y > H - 50) { doc.addPage(); y = 22; }
    doc.setFont(FONT, "bold").setFontSize(11.5).setTextColor(...VERDE).text(pdfTesto(t), M, y);
    doc.setDrawColor(...LINEA).setLineWidth(0.3).line(M, y + 1.8, W - M, y + 1.8);
    y += 6.5;
  };
  const paragrafo = (t, colore = GRAFITE, dimensione = 8.2) => {
    doc.setFont(FONT, "normal").setFontSize(dimensione).setTextColor(...colore);
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
  doc.setFont(FONT, "bold").setFontSize(16).setTextColor(...VERDE);
  doc.text(pdfTesto(c.titolo), M, 37);
  doc.setFont(FONT, "normal").setFontSize(10).setTextColor(...GRAFITE);
  doc.text(pdfTesto(c.sottotitolo), M, 43);
  y = 48;

  // Avvertenza in un riquadro ocra.
  doc.setFont(FONT, "normal").setFontSize(8.2);
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

  // ---------- Grafici (due per riga, come nella pagina) ----------
  if (c.grafici?.length) {
    doc.addPage();
    y = 22;
    titolo("Grafici");
    const gw = (W - 2 * M - 8) / 2;
    const gh = 62;
    for (let i = 0; i < c.grafici.length; i += 2) {
      if (y + gh > H - 16) { doc.addPage(); y = 22; }
      grafico(doc, FONT, c.grafici[i], M, y, gw, gh);
      if (c.grafici[i + 1]) grafico(doc, FONT, c.grafici[i + 1], M + gw + 8, y, gw, gh);
      y += gh + 6;
    }
    y += 2;
  }

  // Tabella «etichetta | valore» (scheda di una sezione).
  const schedaKV = (righe, larghezza = 180, intestazione = null) =>
    tabella({
      ...(intestazione ? { head: [intestazione.map(pdfTesto)] } : {}),
      body: righe.map((r) => r.map((v) => pdfTesto(v ?? "—"))),
      tableWidth: larghezza,
      pageBreak: "avoid",
      columnStyles: { 0: { cellWidth: larghezza * 0.5, fontStyle: "bold", fillColor: VERDE_CHIARO } },
    });

  // ---------- 1. Impostazioni ----------
  titolo("1. Impostazioni");
  schedaKV(c.impostazioni, 190);
  y += 4;
  paragrafo(
    `Buffer secondo il Capitolo 7 della Metodologia: ${String(c.buffer.totale).replace(".", ",")}% (` +
      c.buffer.voci.map(([v, p]) => `${v} ${String(p).replace(".", ",")}%`).join(" + ") +
      `)${c.buffer.uguale ? "; è il buffer applicato." : "; il buffer applicato è quello indicato sopra."}`
  );
  y += 4;

  // ---------- 2. Scenario di riferimento ----------
  // Scheda e riepilogo affiancati; sotto, i rifiuti per tipologia (la
  // tabella può continuare nella pagina dopo, con l'intestazione ripetuta).
  titolo("2. Scenario di riferimento (Standard 4.8.1)");
  {
    const meta2 = (W - 2 * M - 8) / 2;
    const y0 = y;
    autoTable(doc, {
      ...base,
      startY: y0,
      margin: { ...base.margin, right: M + meta2 + 8 },
      body: c.riferimento.scheda.map(([k, v]) => [pdfTesto(k), pdfTesto(v ?? "—")]),
      columnStyles: { 0: { cellWidth: 62, fontStyle: "bold", fillColor: VERDE_CHIARO } },
    });
    const ySx = doc.lastAutoTable.finalY;
    autoTable(doc, {
      ...base,
      startY: y0,
      margin: { ...base.margin, left: M + meta2 + 8 },
      body: c.riferimento.riepilogo.map(([k, v, u]) => [pdfTesto(k), pdfTesto(u === "kgCO2eq/kg" ? (v == null ? "—" : `${num(v, 2)} ${u}`) : valoreSintesi(v, u))]),
      columnStyles: { 0: { fontStyle: "bold", fillColor: VERDE_CHIARO }, 1: { halign: "right", fontStyle: "bold" } },
    });
    y = Math.max(ySx, doc.lastAutoTable.finalY) + 5;
  }
  tabella({
    head: [c.riferimento.rifiuti.colonne.map(pdfTesto)],
    body: c.riferimento.rifiuti.righe.map(([k, q, kg]) => [pdfTesto(k), num(q, 1), num(kg, 1)]),
    foot: [[c.riferimento.rifiuti.totale[0], num(c.riferimento.rifiuti.totale[1], 1), num(c.riferimento.rifiuti.totale[2], 1)]],
    tableWidth: 130,
    // Tabella corta: se non entra tutta si sposta nella pagina dopo.
    pageBreak: "avoid",
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    footStyles: { fillColor: VERDE_CHIARO, textColor: INK, fontStyle: "bold", halign: "right" },
  });
  y += 7;

  // ---------- Situazione attuale ----------
  titolo("Situazione attuale (facoltativa)");
  if (c.attuale) {
    tabella({
      body: c.attuale.map(([k, v, u]) => [pdfTesto(k), pdfTesto(u === "" ? v ?? "—" : u === "ab" ? (v == null ? "—" : num(v, 0)) : valoreSintesi(v, u))]),
      tableWidth: 120,
      pageBreak: "avoid",
      columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", fillColor: VERDE_CHIARO }, 1: { halign: "right" } },
    });
    y += 7;
  } else {
    paragrafo("Non compilata: gli obiettivi partono dallo scenario di riferimento.");
    y += 3;
  }

  // ---------- 3. Obiettivi anno per anno ----------
  titolo("3. Obiettivi anno per anno");
  tabella({
    head: [c.obiettivi.colonne.map(pdfTesto)],
    body: c.obiettivi.righe.map((r) => r.map((v, i) => (i === 0 ? String(v) : i === 1 ? num(v, 0) : num(v, 1)))),
    styles: { ...base.styles, fontSize: 7.3, halign: "right" },
    headStyles: { ...base.headStyles, halign: "center", fontSize: 7 },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
  });
  y += 7;

  // ---------- 4. Risultati: crediti anno per anno ----------
  titolo("4. Risultati: crediti stimati anno per anno");
  const colPunti = c.anni.colonne.findIndex((h) => h.startsWith("Punti oltre"));
  const cella = (v, i) => {
    if (i === 0) return String(v);
    if (v == null) return "";
    if (i === colPunti) return `${v >= 0 ? "+" : ""}${num(v, 1)}`;
    return num(v, 1);
  };
  tabella({
    head: [c.anni.colonne.map(pdfTesto)],
    body: c.anni.righe.map((r) => r.map(cella)),
    ...(c.anni.totali ? { foot: [c.anni.totali.map((v, i) => (i === 0 ? "Totale" : cella(v, i)))] } : {}),
    styles: { ...base.styles, fontSize: 7.3, halign: "right" },
    headStyles: { ...base.headStyles, halign: "center", fontSize: 7 },
    footStyles: { fillColor: VERDE_CHIARO, textColor: INK, fontStyle: "bold", halign: "right" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
  });
  y += 5;
  if (c.spiegazione) paragrafo(c.spiegazione);
  y += 4;

  // ---------- 5. Parte economica ----------
  if (c.parametriEconomici || c.economia || c.costi) titolo("5. Simulazione economica: ricavi e costi per il Comune (IVA esclusa)");
  if (c.parametriEconomici) {
    tabella({
      head: [["Parametri inseriti", ""]],
      body: c.parametriEconomici.map(([k, v, u]) => [
        pdfTesto(k),
        pdfTesto(u === "testo" ? v : u === "ab" ? (v == null ? "—" : `${num(v, 0)} abitanti`) : u === "€" ? (v == null ? "—" : `${num(v, 2)} €`) : valoreSintesi(v, u)),
      ]),
      tableWidth: 150,
      pageBreak: "avoid",
      columnStyles: { 0: { cellWidth: 80, fontStyle: "bold", fillColor: VERDE_CHIARO }, 1: { halign: "right" } },
    });
    y += 7;
  }
  if (c.costi) {
    if (y > H - 60) { doc.addPage(); y = 22; }
    doc.setFont(FONT, "bold").setFontSize(9.5).setTextColor(...VERDE).text(pdfTesto(`Costi annui del Programma — ${c.costi.listino}`), M, y);
    y += 3;
    tabella({
      head: [["Voce", "Tipo", "€/abitante/anno", "€/anno"].map(pdfTesto)],
      body: c.costi.righe.map(([v, t, u, imp]) => [pdfTesto(v), t, num(u, 2), num(imp, 2)]),
      foot: [[pdfTesto(c.costi.totale[0]), "", num(c.costi.totale[2], 2), num(c.costi.totale[3], 2)]],
      tableWidth: 190,
      pageBreak: "avoid",
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
      footStyles: { fillColor: VERDE_CHIARO, textColor: INK, fontStyle: "bold", halign: "right" },
    });
    y += 5;
    paragrafo("Tabelle «Costi per il Soggetto Promotore» di Fondazione Operate (28/07/2026), progetti di 10 anni; le voci una tantum sono già ammortizzate sui 10 anni. Non comprendono la validazione dell'ente.");
    y += 3;
  }
  if (c.economia) {
    if (y > H - 60) { doc.addPage(); y = 22; }
    doc.setFont(FONT, "bold").setFontSize(9.5).setTextColor(...VERDE).text("Ricavi, costi e margine anno per anno", M, y);
    y += 3;
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
      doc.setFont(FONT, "normal").setFontSize(7.5).setTextColor(...GRAFITE);
      doc.text(pdfTesto(`${c.titolo} · ${c.sottotitolo}`), M, 11);
      doc.setDrawColor(...LINEA).setLineWidth(0.2).line(M, 13, W - M, 13);
    }
    doc.setFont(FONT, "normal").setFontSize(7.5).setTextColor(...GRAFITE);
    doc.text(pdfTesto("Fondazione Operate · Portale Carbon WastePrint · stima ex ante non certificabile"), M, H - 7);
    doc.text(`Pagina ${i} di ${pagine}`, W - M, H - 7, { align: "right" });
  }
  return { blob: doc.output("blob"), nomeFile };
}
