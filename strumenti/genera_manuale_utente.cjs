/* =========================================================================
   Genera il Manuale Utente in Word (.docx) con copertina, loghi, registro
   delle revisioni, sommario con numeri di pagina, intestazione e piè di
   pagina.

   Sorgenti:  docs/manuale-utente.md                (testo)
              strumenti/manuale_utente_revisioni.json (revisioni: l'ultima è quella corrente)
   Uscita:    public/manuali/Manuale_Utente_Portale_CWP.docx (+ .pdf se c'è LibreOffice)

   Uso:  node strumenti/genera_manuale_utente.cjs
   Richiede la libreria "docx" (npm install --no-save docx) e, per i numeri
   di pagina del sommario e il PDF, LibreOffice e pdftotext.
   ========================================================================= */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, HeadingLevel, BorderStyle, ShadingType, Header, Footer, PageNumber,
  LevelFormat, ExternalHyperlink, InternalHyperlink, Bookmark, Tab, TabStopType,
  LeaderType, TableLayoutType, VerticalAlign, PageBreak,
} = require("docx");

const RADICE = path.join(__dirname, "..");
const SORGENTE = path.join(RADICE, "docs", "manuale-utente.md");
const REVISIONI = JSON.parse(fs.readFileSync(path.join(__dirname, "manuale_utente_revisioni.json"), "utf8"));
const USCITA_DIR = path.join(RADICE, "public", "manuali");
const NOME = "Manuale_Utente_Portale_CWP";
const LOGO_CWP = fs.readFileSync(path.join(RADICE, "public", "loghi", "carbonwasteprint.png"));
const LOGO_FO = fs.readFileSync(path.join(RADICE, "public", "loghi", "fondazione-operate.png"));

const REV = REVISIONI[REVISIONI.length - 1];
const VERDE = "2F5D3A", VERDE_CHIARO = "E4EDE1", INK = "1B2118", GRAFITE = "5A5E54", LINEA = "D9D4C5", CARTA = "F6F4EE";
const FONT = "Arial";
const LARGHEZZA = 11906 - 2 * 1134; // A4, margini 2 cm → 9638 DXA

// ---------- lettura del markdown ----------
function leggiCapitoli() {
  const testo = fs.readFileSync(SORGENTE, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const capitoli = [];
  let corrente = null;
  for (const riga of testo.split("\n")) {
    const h = /^## (.+)$/.exec(riga);
    if (h) {
      corrente = { titolo: h[1].trim(), righe: [] };
      capitoli.push(corrente);
    } else if (corrente) corrente.righe.push(riga);
  }
  return capitoli;
}

// Blocchi: paragrafo, elenco puntato, elenco numerato, tabella.
function blocchi(righe) {
  const out = [];
  let i = 0;
  while (i < righe.length) {
    const r = righe[i];
    if (!r.trim()) { i++; continue; }
    if (/^\|/.test(r)) {
      const t = [];
      while (i < righe.length && /^\|/.test(righe[i])) t.push(righe[i++]);
      const celle = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      out.push({ tipo: "tabella", intestazione: celle(t[0]), righe: t.slice(2).map(celle) });
      continue;
    }
    if (/^- /.test(r)) {
      const v = [];
      while (i < righe.length && /^- /.test(righe[i])) v.push(righe[i++].slice(2));
      out.push({ tipo: "puntato", voci: v });
      continue;
    }
    if (/^\d+\. /.test(r)) {
      const v = [];
      while (i < righe.length && /^\d+\. /.test(righe[i])) v.push(righe[i++].replace(/^\d+\. /, ""));
      out.push({ tipo: "numerato", voci: v });
      continue;
    }
    const p = [];
    while (i < righe.length && righe[i].trim() && !/^(\||- |\d+\. )/.test(righe[i])) p.push(righe[i++]);
    out.push({ tipo: "paragrafo", testo: p.join(" ") });
  }
  return out;
}

// Testo con **grassetto**, *corsivo*, `codice`, [link](url).
function runs(testo, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let ultimo = 0, m;
  const semplice = (t, extra = {}) => new TextRun({ text: t, font: FONT, color: INK, ...base, ...extra });
  while ((m = re.exec(testo))) {
    if (m.index > ultimo) out.push(semplice(testo.slice(ultimo, m.index)));
    const s = m[0];
    if (s.startsWith("**")) out.push(semplice(s.slice(2, -2), { bold: true }));
    else if (s.startsWith("`")) out.push(semplice(s.slice(1, -1), { font: "Consolas", color: VERDE }));
    else if (s.startsWith("[")) {
      const [, t, url] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s);
      out.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: t, font: FONT, color: VERDE, underline: {}, ...base })] }));
    } else out.push(semplice(s.slice(1, -1), { italics: true }));
    ultimo = m.index + s.length;
  }
  if (ultimo < testo.length) out.push(semplice(testo.slice(ultimo)));
  return out;
}

// ---------- elementi grafici ----------
const bordoTabella = { style: BorderStyle.SINGLE, size: 4, color: LINEA };
const bordi = { top: bordoTabella, bottom: bordoTabella, left: bordoTabella, right: bordoTabella };

function larghezzeColonne(intestazione, righe) {
  const n = intestazione.length;
  const lun = intestazione.map((h, j) => Math.max(h.length, ...righe.map((r) => (r[j] || "").length)));
  const pesi = lun.map((l) => Math.min(Math.max(l, 8), 60));
  const somma = pesi.reduce((a, b) => a + b, 0);
  const w = pesi.map((p) => Math.round((p / somma) * LARGHEZZA));
  w[n - 1] += LARGHEZZA - w.reduce((a, b) => a + b, 0);
  return w;
}

function tabella(intestazione, righe, larghezze) {
  const w = larghezze || larghezzeColonne(intestazione, righe);
  const cella = (testo, j, testa, pari) =>
    new TableCell({
      width: { size: w[j], type: WidthType.DXA },
      borders: bordi,
      shading: testa ? { fill: VERDE, type: ShadingType.CLEAR, color: "auto" } : pari ? { fill: CARTA, type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: testa ? [new TextRun({ text: testo, bold: true, color: "FFFFFF", font: FONT, size: 19 })] : runs(testo, { size: 19 }) })],
    });
  return new Table({
    width: { size: LARGHEZZA, type: WidthType.DXA },
    columnWidths: w,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, children: intestazione.map((h, j) => cella(h, j, true)) }),
      ...righe.map((r, i) => new TableRow({ cantSplit: true, children: intestazione.map((_, j) => cella(r[j] || "", j, false, i % 2 === 1)) })),
    ],
  });
}

const spazio = (dopo = 120) => new Paragraph({ spacing: { after: dopo }, children: [] });

// ---------- costruzione del documento ----------
let istanza = 0;
function contenutoCapitolo(n, cap) {
  const ancora = `cap${n}`;
  const out = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { before: 0, after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 6 } },
      children: [new Bookmark({ id: ancora, children: [new TextRun({ text: `${n}. ${cap.titolo}`, font: FONT, bold: true, size: 34, color: VERDE })] })],
    }),
  ];
  for (const b of blocchi(cap.righe)) {
    if (b.tipo === "paragrafo") out.push(new Paragraph({ spacing: { after: 140, line: 300 }, children: runs(b.testo, { size: 21 }) }));
    else if (b.tipo === "puntato")
      b.voci.forEach((v) => out.push(new Paragraph({ numbering: { reference: "punti", level: 0 }, spacing: { after: 70, line: 290 }, children: runs(v, { size: 21 }) })));
    else if (b.tipo === "numerato") {
      istanza++;
      b.voci.forEach((v) => out.push(new Paragraph({ numbering: { reference: "numeri", level: 0, instance: istanza }, spacing: { after: 70, line: 290 }, children: runs(v, { size: 21 }) })));
      out.push(spazio(60));
    } else if (b.tipo === "tabella") {
      out.push(tabella(b.intestazione, b.righe));
      out.push(spazio(160));
    }
  }
  return out;
}

function copertina() {
  const riga = (etichetta, valore) => [etichetta, valore];
  const info = [
    riga("Documento", "Manuale Utente — Portale Carbon WastePrint"),
    riga("Destinatari", "Comuni, enti locali e soggetti gestori aderenti al Programma"),
    riga("Revisione", `Rev. ${REV.rev}`),
    riga("Data di revisione", REV.data),
    riga("Redatto da", "Fondazione Operate"),
  ];
  const w = [2600, LARGHEZZA - 2600];
  const tabInfo = new Table({
    width: { size: LARGHEZZA, type: WidthType.DXA },
    columnWidths: w,
    layout: TableLayoutType.FIXED,
    rows: info.map(([a, b]) =>
      new TableRow({
        children: [
          new TableCell({ width: { size: w[0], type: WidthType.DXA }, borders: bordi, shading: { fill: VERDE_CHIARO, type: ShadingType.CLEAR, color: "auto" }, margins: { top: 90, bottom: 90, left: 140, right: 140 }, children: [new Paragraph({ children: [new TextRun({ text: a, bold: true, font: FONT, size: 20, color: VERDE })] })] }),
          new TableCell({ width: { size: w[1], type: WidthType.DXA }, borders: bordi, margins: { top: 90, bottom: 90, left: 140, right: 140 }, children: [new Paragraph({ children: [new TextRun({ text: b, font: FONT, size: 20, color: INK })] })] }),
        ],
      })
    ),
  });
  return [
    new Paragraph({ spacing: { before: 900, after: 200 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: LOGO_CWP, transformation: { width: 300, height: 186 } })] }),
    new Paragraph({ spacing: { before: 500, after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MANUALE UTENTE", font: FONT, bold: true, size: 56, color: VERDE, characterSpacing: 40 })] }),
    new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Portale Carbon WastePrint®", font: FONT, size: 32, color: INK })] }),
    new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 12 } }, children: [new TextRun({ text: "Guida passo per passo per Comuni, enti e soggetti gestori", font: FONT, italics: true, size: 24, color: GRAFITE })] }),
    tabInfo,
    new Paragraph({ spacing: { before: 2600, after: 80 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Programma di", font: FONT, size: 18, color: GRAFITE })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: LOGO_FO, transformation: { width: 200, height: 72 } })] }),
  ];
}

function pagineIniziali(capitoli, pagine) {
  const titolo = (t) => new Paragraph({ spacing: { before: 0, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 6 } }, children: [new TextRun({ text: t, font: FONT, bold: true, size: 30, color: VERDE })] });
  const revisioni = tabella(
    ["Rev.", "Data", "Descrizione", "Autore"],
    REVISIONI.slice().reverse().map((r) => [r.rev, r.data, r.descrizione, r.autore]),
    [800, 1300, LARGHEZZA - 800 - 1300 - 2000, 2000]
  );
  const voci = capitoli.map((c, i) =>
    new Paragraph({
      spacing: { after: 130 },
      tabStops: [{ type: TabStopType.RIGHT, position: LARGHEZZA, leader: LeaderType.DOT }],
      children: [
        new InternalHyperlink({
          anchor: `cap${i + 1}`,
          children: [
            new TextRun({ text: `${i + 1}.  ${c.titolo}`, font: FONT, size: 22, color: INK }),
            new TextRun({ children: [new Tab(), pagine ? String(pagine[i] ?? "") : ""], font: FONT, size: 22, color: INK }),
          ],
        }),
      ],
    })
  );
  return [
    titolo("Registro delle revisioni"),
    revisioni,
    spazio(240),
    new Paragraph({ spacing: { after: 100 }, children: runs(`Questo documento descrive il portale alla revisione ${REV.rev} del ${REV.data}. La versione sempre aggiornata del manuale è disponibile online; a ogni modifica del portale il manuale viene aggiornato e la revisione incrementata.`, { size: 20, color: GRAFITE }) }),
    new Paragraph({ children: [new PageBreak()] }),
    titolo("Sommario"),
    ...voci,
  ];
}

function intestazione() {
  return new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINEA, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: LARGHEZZA }],
        children: [
          new ImageRun({ type: "png", data: LOGO_CWP, transformation: { width: 58, height: 36 } }),
          new TextRun({ children: [new Tab(), `Manuale Utente · Rev. ${REV.rev} · ${REV.data}`], font: FONT, size: 16, color: GRAFITE }),
        ],
      }),
    ],
  });
}

function pieDiPagina() {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINEA, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: LARGHEZZA }],
        children: [
          new TextRun({ text: "Fondazione Operate · Programma Carbon WastePrint®", font: FONT, size: 16, color: GRAFITE }),
          new TextRun({ children: [new Tab(), "Pagina ", PageNumber.CURRENT, " di ", PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: GRAFITE }),
        ],
      }),
    ],
  });
}

function documento(capitoli, pagine) {
  istanza = 0;
  const margini = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 567, footer: 567 } } };
  return new Document({
    creator: "Fondazione Operate",
    title: `Manuale Utente — Portale Carbon WastePrint (Rev. ${REV.rev})`,
    description: "Guida al portale per Comuni, enti e soggetti gestori",
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: INK } } },
      paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 34, bold: true, color: VERDE }, paragraph: { outlineLevel: 0 } }],
    },
    numbering: {
      config: [
        { reference: "punti", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } }, run: { color: VERDE } } }] },
        { reference: "numeri", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } }, run: { bold: true, color: VERDE } } }] },
      ],
    },
    sections: [
      { properties: { ...margini, titlePage: false }, children: copertina() },
      { properties: margini, headers: { default: intestazione() }, footers: { default: pieDiPagina() }, children: pagineIniziali(capitoli, pagine) },
      { properties: margini, headers: { default: intestazione() }, footers: { default: pieDiPagina() }, children: capitoli.flatMap((c, i) => contenutoCapitolo(i + 1, c)) },
    ],
  });
}

// Pagine dei capitoli lette dal PDF (prima passata) per il sommario.
function paginePdf(pdf, capitoli) {
  const testo = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
  const pagine = testo.split("\f");
  return capitoli.map((c, i) => {
    const cercato = `${i + 1}. ${c.titolo}`;
    const idx = pagine.findIndex((p, k) => k > 2 && p.split("\n").some((l) => l.trim() === cercato));
    return idx >= 0 ? idx + 1 : null;
  });
}

function aPdf(docx) {
  try {
    execFileSync(process.env.SOFFICE || "soffice", ["--headless", "--convert-to", "pdf", "--outdir", USCITA_DIR, docx], { stdio: "ignore" });
    return docx.replace(/\.docx$/, ".pdf");
  } catch {
    return null;
  }
}

(async () => {
  fs.mkdirSync(USCITA_DIR, { recursive: true });
  const capitoli = leggiCapitoli();
  const file = path.join(USCITA_DIR, `${NOME}.docx`);
  fs.writeFileSync(file, await Packer.toBuffer(documento(capitoli, null)));
  const pdf = aPdf(file);
  if (pdf) {
    const pagine = paginePdf(pdf, capitoli);
    fs.writeFileSync(file, await Packer.toBuffer(documento(capitoli, pagine)));
    aPdf(file);
    console.log("Sommario:", capitoli.map((c, i) => `${i + 1}→p.${pagine[i]}`).join(" "));
  } else {
    console.log("LibreOffice non disponibile: sommario senza numeri di pagina, nessun PDF.");
  }
  console.log("Creato", path.relative(RADICE, file), `(Rev. ${REV.rev}, ${REV.data})`);
})();
