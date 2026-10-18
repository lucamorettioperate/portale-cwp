/* =========================================================================
   Rapporto di calcolo dei crediti in PDF (backlog 6, 18/10/2026).
   Genera nel browser, con jsPDF e jspdf-autotable, il rapporto di un
   calcolo: scheda, sintesi dei crediti, buffer, dati di ingresso, risultati
   per tipologia e per classe, avvisi, controlli di coerenza e scelte
   interpretative. Il dettaglio per singola utenza NON è incluso (resta nel
   CSV) per riservatezza e dimensione.
   Il rapporto riporta un'impronta SHA-256 dei dati e del risultato: chi lo
   riceve può verificare che corrisponda al calcolo archiviato nel portale.
   Usato da src/pages/CalcoloCrediti.jsx («Scarica il rapporto (PDF)» e
   «Archivia nella pratica»). Registro sviluppo e deploy: «Calcolo crediti».
   ========================================================================= */
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { TIPOLOGIE_RIFIUTO } from "./parametri.js";

const VERDE = [47, 93, 58];
const VERDE_CHIARO = [228, 237, 225];
const INK = [27, 33, 24];
const GRAFITE = [90, 94, 84];
const LINEA = [217, 212, 197];
const OCRA = [176, 106, 47];
const ROSSO = [162, 59, 44];

// I caratteri standard del PDF non hanno i pedici: CO₂ → CO2, ≤ → <=.
const pdfTesto = (s) =>
  String(s ?? "")
    .replace(/₂/g, "2").replace(/₃/g, "3").replace(/≤/g, "<=").replace(/≥/g, ">=")
    .replace(/Δ/g, "Delta ").replace(/[−–]/g, "-").replace(/×/g, "x").replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xFF€—…·•]/g, "");

const num = (v, d = 2) =>
  v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
const dataIt = (v) => (v ? new Date(v).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const dataOraIt = (v) => (v ? new Date(v).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const tipNome = (t) => TIPOLOGIE_RIFIUTO.find((x) => x.id === t)?.nome || t;

// Impronta SHA-256 (esadecimale) di un oggetto, con chiavi in ordine stabile.
export async function impronta(oggetto) {
  const ordina = (v) => (Array.isArray(v) ? v.map(ordina) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordina(v[k])])) : v);
  const byte = new TextEncoder().encode(JSON.stringify(ordina(oggetto)));
  const d = await crypto.subtle.digest("SHA-256", byte);
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Logo come immagine per il PDF (null se non disponibile).
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

/* Genera il rapporto. Parametri:
   - calcolo: riga di calcolo_crediti (con pratica e organizzazione);
   - dati: dati del calcolo (rifiuti, delibera, fattori, opzioni, importazione);
   - risultato: riepilogo salvato del calcolo (calcolo.risultato);
   - coerenza: esiti di controllaCoerenza (facoltativo);
   - confermatoDa: nome di chi ha confermato (facoltativo).
   Restituisce { blob, nomeFile, impronta }. */
export async function generaRapportoPdf({ calcolo, dati, risultato: r, coerenza = [], confermatoDa = null }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16; // margine
  const confermato = calcolo.stato === "confermato";
  const hash = await impronta({ dati, risultato: r });
  const codice = calcolo.pratica?.codice || "pratica";
  const tabellaBase = {
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, textColor: INK, lineColor: LINEA, lineWidth: 0.15 },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 245] },
    margin: { left: M, right: M, top: 22, bottom: 18 },
  };
  let y = 0;
  // Tabella che non lascia l'intestazione da sola in fondo alla pagina.
  const tabella = (opzioni) => {
    if (y > 245) { doc.addPage(); y = 24; }
    autoTable(doc, { ...tabellaBase, ...opzioni, startY: y });
    y = doc.lastAutoTable.finalY;
  };

  // ---------- Intestazione ----------
  const [logoCwp, logoFo] = await Promise.all([immagine("/loghi/carbonwasteprint.png"), immagine("/loghi/fondazione-operate.png")]);
  if (logoCwp) doc.addImage(logoCwp.dataUrl, "PNG", M, 10, (logoCwp.w / logoCwp.h) * 18, 18);
  if (logoFo) {
    const w = (logoFo.w / logoFo.h) * 10;
    doc.addImage(logoFo.dataUrl, "PNG", W - M - w, 14, w, 10);
  }
  doc.setDrawColor(...VERDE).setLineWidth(0.6).line(M, 32, W - M, 32);
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...VERDE);
  doc.text("Rapporto di calcolo dei crediti CWP", M, 42);
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...GRAFITE);
  doc.text(pdfTesto(`Programma Carbon WastePrint® · Metodologia v${r.versioneMetodologia || "1.2"} · ${calcolo.pratica?.organizzazione?.denominazione || ""}`), M, 48);
  y = 54;

  // ---------- Scheda ----------
  const scheda = [
    ["Pratica", `${codice}${calcolo.pratica?.titolo ? " — " + calcolo.pratica.titolo : ""}`],
    ["Ente", calcolo.pratica?.organizzazione?.denominazione || "—"],
    ["Calcolo", calcolo.titolo],
    ["Anno di riferimento", String(calcolo.anno)],
    ["Tipo di stima", calcolo.tipo === "ex_post" ? "Ex post (letture reali della Banca Dati Utenze)" : "Ex ante (valori stimati)"],
    ...(r.periodo?.coefficiente < 1 ? [["Primo anno", `Avvio ${dataIt(r.periodo.dataAvvio)}: ${r.periodo.giorni} giorni (coefficiente ${num(r.periodo.coefficiente, 4)})`]] : []),
    ...(calcolo.numero_registro ? [["Numero di registro", calcolo.numero_registro]] : []),
    ["Stato", confermato ? `Confermato il ${dataOraIt(calcolo.confermato_il)}${confermatoDa ? " da " + confermatoDa : ""}` : "BOZZA — non è un rapporto definitivo"],
    ...(calcolo.versione_di ? [["Versione", "Nuova versione di un calcolo confermato in precedenza"]] : []),
    ["Calcolato il", dataOraIt(r.calcolatoIl)],
    ...(dati.importazione ? [["Dati importati da", `${dati.importazione.file} il ${dataOraIt(dati.importazione.importatoIl)}`]] : []),
    ["Impronta dei dati (SHA-256)", hash],
  ];
  tabella({
    body: scheda.map(([k, v]) => [pdfTesto(k), pdfTesto(v)]),
    columnStyles: { 0: { cellWidth: 46, fontStyle: "bold", fillColor: VERDE_CHIARO }, 1: { cellWidth: "auto" } },
    styles: { ...tabellaBase.styles, fontSize: 8.5 },
  });
  y += 8;

  // ---------- Sintesi ----------
  const titolo = (t) => {
    if (y > 240) { doc.addPage(); y = 24; }
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...VERDE).text(pdfTesto(t), M, y);
    doc.setDrawColor(...LINEA).setLineWidth(0.3).line(M, y + 1.8, W - M, y + 1.8);
    y += 7;
  };
  const paragrafo = (t, colore = GRAFITE) => {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...colore);
    const righe = doc.splitTextToSize(pdfTesto(t), W - 2 * M);
    if (y + righe.length * 4 > 280) { doc.addPage(); y = 24; }
    doc.text(righe, M, y);
    y += righe.length * 4 + 2;
  };
  titolo("1. Sintesi");
  const riquadri = r.crediti.debito > 0
    ? [["Debito del territorio", `${num(r.crediti.debito, 3)} tCO2eq`, ROSSO], ["Delta I del territorio", `${num(r.deltaI, 1)} kgCO2eq`, INK], ["Buffer", `${num(r.buffer.totale, 1)} %`, INK]]
    : [["Crediti netti", `${num(r.crediti.netti, 3)} tCO2eq`, VERDE], ["Crediti lordi (-Delta I)", `${num(r.crediti.lordi, 3)} tCO2eq`, INK], ["Buffer applicato", `${num(r.buffer.totale, 1)} % (${num(r.crediti.buffer, 3)} t)`, INK]];
  const lb = (W - 2 * M - 8) / 3;
  riquadri.forEach(([et, val, col], i) => {
    const x = M + i * (lb + 4);
    doc.setFillColor(...VERDE_CHIARO).setDrawColor(...LINEA).roundedRect(x, y, lb, 20, 2, 2, "FD");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAFITE).text(pdfTesto(et), x + 4, y + 6);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...col).text(pdfTesto(val), x + 4, y + 15);
  });
  y += 26;
  paragrafo(
    `Utenze considerate: ${(r.utenze.totale || 0).toLocaleString("it-IT")} (equivalenti ${num(r.utenze.equivalenti, 0)}), di cui ${(r.utenze.virtuose || 0).toLocaleString("it-IT")} con emissioni inferiori all'atteso. ` +
      `Emissioni attese del territorio: ${num(r.attesa.EAterritorio, 2)} tCO2eq su ${num(r.attesa.Qtot, 2)} t di rifiuti. ` +
      (dati.opzioni?.soloVirtuose ? "Il calcolo considera solo le utenze che riducono le emissioni." : "Il calcolo considera tutte le utenze della Banca Dati.")
  );

  // ---------- Buffer ----------
  titolo("2. Analisi del rischio e buffer (Capitolo 7)");
  tabella({
    head: [["Voce", "Valore"]],
    body: [
      ...r.buffer.voci.map((v) => [pdfTesto(v.voce), `${v.valore > 0 ? "+" : ""}${num(v.valore, 1)} %`]),
      [{ content: pdfTesto(`Totale applicato${r.buffer.manuale ? ` (indicato dal Progetto; calcolato ${num(r.buffer.calcolato, 1)} %)` : ""}`), styles: { fontStyle: "bold" } }, { content: `${num(r.buffer.totale, 1)} %`, styles: { fontStyle: "bold" } }],
    ],
    columnStyles: { 1: { halign: "right", cellWidth: 30 } },
  });
  y += 3;
  if (r.buffer.manuale && dati.opzioni?.motivazioneBuffer) paragrafo(`Motivazione del buffer indicato dal Progetto: ${dati.opzioni.motivazioneBuffer}`);
  y += 4;

  // ---------- Dati di ingresso ----------
  titolo("3. Dati di ingresso");
  paragrafo("Rifiuti del territorio (Catasto ISPRA / MUD), in tonnellate nell'anno di riferimento.");
  tabella({
    head: [["Codice EER", "Descrizione", "Tipologia", "Qtot (t)", "Solo dom.", "Considerato"]],
    body: (dati.rifiuti || []).map((x) => [x.codice, pdfTesto(x.descrizione), pdfTesto(tipNome(x.tipologia)), num(Number(String(x.qtot).replace(",", ".")), 3), x.soloDomestiche ? "sì" : "—", x.considerato === false ? "no" : "sì"]),
    columnStyles: { 3: { halign: "right" } },
  });
  y += 5;
  paragrafo(`Delibera tariffaria: PEF utenze domestiche ${dati.pefUd || "—"} %, non domestiche ${dati.pefUnd || "—"} %.`);
  tabella({
    head: [["Classe / categoria", "Macro", "N. utenze", "Kb", "Superficie (m2)", "Kd"]],
    body: [
      ...(dati.classiUd || []).map((c) => [pdfTesto(c.classe), "UD", num(c.n, 0), String(c.kb ?? "—"), "—", "—"]),
      ...(dati.classiUnd || []).map((c) => [pdfTesto(c.classe), "UnD", num(c.n, 0), "—", num(c.superficie, 0), String(c.kd ?? "—")]),
    ],
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });
  y += 5;
  const usate = new Set((r.attesa?.tipologie || []).map((t) => t.tipologia).concat(r.tipologieMisurate || []));
  paragrafo("Fattori di emissione FErid(r) e pesi specifici usati (Metodologia, Tabelle 3, 4 e 8, salvo diversa indicazione).");
  tabella({
    head: [["Tipologia", "FE (kgCO2eq/kg)", "Peso specifico (kg/m3)", "Fonte"]],
    body: (dati.fattori || [])
      .filter((f) => usate.has(f.id))
      .map((f) => [
        pdfTesto(f.nome),
        f.id === "indifferenziato" && r.indifferenziato?.fe != null ? `${num(r.indifferenziato.fe, 4)} (calcolato)` : num(f.fe, 3),
        num(r.pesiSpecifici?.ps?.[f.id] ?? f.ps, 1),
        pdfTesto(f.fonte || "—"),
      ]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });
  y += 5;
  if (r.indifferenziato?.composizione?.length) {
    paragrafo(`FE dell'indifferenziato calcolato con le formule 16-17 dalla composizione: ${r.indifferenziato.composizione.map((c) => `${tipNome(c.tipologia)} ${num(c.quota * 100, 1)}%`).join(", ")}.`);
  }
  if (dati.importazione?.conteggi) {
    const k = dati.importazione.conteggi;
    paragrafo(`Banca Dati Utenze: ${(k.conferimenti || 0).toLocaleString("it-IT")} righe di conferimento per ${(k.utenze || 0).toLocaleString("it-IT")} utenze${k.letture ? `, ottenute da ${(k.lettureUsate || 0).toLocaleString("it-IT")} singole letture` : ""}; ${k.riuso || 0} righe di beni a riuso.`);
  }
  y += 2;

  // ---------- Risultati ----------
  titolo("4. Produzione ed emissioni attese del territorio");
  paragrafo(`Qtot ${num(r.attesa.Qtot, 2)} t · ripartizione P%UD ${num(r.attesa.pUd * 100, 2)} % · P%UnD ${num(r.attesa.pUnD * 100, 2)} %.`);
  tabella({
    head: [["Tipologia", "Qtot (t)", "QUD (t)", "QUnD (t)", "FE (kgCO2eq/kg)", "EA (tCO2eq)", "Misurata"]],
    body: r.attesa.tipologie.map((t) => [pdfTesto(tipNome(t.tipologia)) + (t.soloDomestiche ? " (solo dom.)" : ""), num(t.qtot, 2), num(t.qud, 2), num(t.qund, 2), num(t.fe, 3), num(t.ea, 2), (r.tipologieMisurate || []).includes(t.tipologia) ? "sì" : "—"]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });
  y += 8;

  titolo("5. Valori attesi e variazione di impatto per classe");
  const tip = r.attesa.tipologie.map((t) => t.tipologia);
  tabella({
    styles: { ...tabellaBase.styles, fontSize: tip.length > 6 ? 6.5 : 7.5 },
    head: [["Classe", "Utenze", "Quota", ...tip.map((t) => pdfTesto(tipNome(t)) + " (kg)")]],
    body: r.attesa.classi.map((c) => [pdfTesto(`${c.macro === "UD" ? "Dom." : "Non dom."} ${c.classe}`), num(c.n, 0), `${num(c.quota * 100, 2)} %`, ...tip.map((t) => num(c.atteso?.[t], 1))]),
    columnStyles: { 0: { cellWidth: 38 }, 2: { cellWidth: 16 }, ...Object.fromEntries([...Array(tip.length + 2)].map((_, i) => [i + 1, { halign: "right", ...(i + 1 === 2 ? { cellWidth: 16 } : {}) }])) },
  });
  y += 5;
  if (r.utenze?.perClasse?.length) {
    tabella({
      head: [["Classe", "Utenze", "Che riducono", "Delta I (kgCO2eq)"]],
      body: r.utenze.perClasse.map((c) => [pdfTesto(`${c.macro === "UD" ? "Dom." : "Non dom."} ${c.classe}`), num(c.utenze, 0), num(c.virtuose, 0), num(c.deltaI, 1)]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y += 8;
  }

  // ---------- Verifiche ----------
  titolo("6. Avvisi e controlli di coerenza");
  const voci = [
    ...(r.avvisi || []).map((a) => ["Avviso del calcolo", a]),
    ...coerenza.map((c) => [c.livello === "errore" ? "Da correggere" : "Da verificare", c.testo]),
  ];
  if (!voci.length) paragrafo("Nessun avviso e nessuna incoerenza rilevata.", VERDE);
  else {
    tabella({
      head: [["Tipo", "Descrizione"]],
      body: voci.map(([t, d]) => [t, pdfTesto(d)]),
      columnStyles: { 0: { cellWidth: 34 } },
      didParseCell: (h) => { if (h.section === "body" && h.column.index === 0 && h.cell.raw === "Da correggere") h.cell.styles.textColor = ROSSO; },
    });
    y += 8;
  }

  titolo("7. Scelte interpretative applicate");
  const scelte = [
    "FEdes(r): si usa FErid(r) delle Tabelle 3 e 4, salvo valori diversi indicati nel Progetto.",
    "Emissioni attese per utenza: calcolate sulle tipologie di rifiuto misurate; le altre sono coperte dal buffer.",
    `Riuso (formule 26 e 29): ${dati.opzioni?.riusoComeCredito ? "trattato come riduzione di emissioni (opzione attiva)" : "applicato come scritto nella Metodologia (opzione «riuso come riduzione» non attiva)"}; scenario ${dati.scenarioRiuso === "preparazione" ? "centro di preparazione per il riutilizzo" : "centro di riutilizzo / operatore dell'usato"}.`,
    "Buffer trattenuto dai crediti lordi: crediti netti = crediti lordi x (1 - buffer).",
    "Tabella 16: combinazioni di rifiuti misurati non elencate nella condizione minima (30%).",
    "Componente trasporto (Capitolo 9) non calcolata a parte: inclusa nei fattori della Tabella 3.",
    "Scelte da confermare dalla Fondazione e dall'Ente di Validazione prima dei calcoli ufficiali.",
  ];
  scelte.forEach((s) => paragrafo(`•  ${s}`, INK));
  y += 2;
  paragrafo(
    "Il rapporto non contiene il dettaglio per singola utenza, disponibile in formato CSV nel portale. " +
      (confermato
        ? "Il calcolo è confermato: dati e risultato sono immutabili nel portale e corrispondono all'impronta SHA-256 indicata nella scheda."
        : "Il calcolo è una BOZZA: dati e risultato possono ancora cambiare.")
  );

  // ---------- Piè di pagina e filigrana ----------
  const pagine = doc.getNumberOfPages();
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i);
    if (!confermato) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.08 }));
      doc.setFont("helvetica", "bold").setFontSize(80).setTextColor(...OCRA);
      doc.text("BOZZA", W / 2, 170, { align: "center", angle: 35 });
      doc.restoreGraphicsState();
    }
    if (i > 1) {
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRAFITE);
      doc.text(pdfTesto(`Rapporto di calcolo dei crediti CWP · ${codice} · anno ${calcolo.anno}`), M, 12);
      doc.setDrawColor(...LINEA).setLineWidth(0.2).line(M, 14, W - M, 14);
    }
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRAFITE);
    doc.text(pdfTesto(`Fondazione Operate · Portale Carbon WastePrint · generato il ${dataOraIt(new Date().toISOString())}`), M, 289);
    doc.text(`Pagina ${i} di ${pagine}`, W - M, 289, { align: "right" });
  }

  const nomeFile = `Rapporto_calcolo_crediti_${codice}_${calcolo.anno}${confermato ? "" : "_BOZZA"}.pdf`.replace(/[^A-Za-z0-9._-]+/g, "_");
  return { blob: doc.output("blob"), nomeFile, impronta: hash };
}
