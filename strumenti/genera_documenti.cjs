/* =========================================================================
   Genera in Word (.docx) e PDF i documenti del portale, con copertina e
   loghi, registro delle revisioni, sommario con numeri di pagina,
   intestazione e piè di pagina:

   - Manuale Utente           docs/manuale-utente.md
                              → public/manuali/Manuale_Utente_Portale_CWP.{docx,pdf}
   - Registro sviluppo/deploy docs/REGISTRO_DEV_DEPLOY.md
                              → public/documentazione/Registro_Dev_Deploy_Portale_CWP.{docx,pdf}

   Le revisioni stanno in strumenti/revisioni_documenti.json (l'ultima di
   ogni documento è quella corrente): a ogni modifica si aggiunge una riga.

   Uso:  node strumenti/genera_documenti.cjs            (tutti)
         node strumenti/genera_documenti.cjs registro   (uno solo: manuale | registro)
   Richiede la libreria "docx" (npm install --no-save docx), LibreOffice
   (numeri di pagina del sommario del Word) e pdftotext; il PDF finale è
   impaginato da strumenti/impagina_pdf.py (pip install weasyprint markdown).
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
const REVISIONI = JSON.parse(fs.readFileSync(path.join(__dirname, "revisioni_documenti.json"), "utf8"));
const LOGO_CWP = fs.readFileSync(path.join(RADICE, "public", "loghi", "carbonwasteprint.png"));
const LOGO_FO = fs.readFileSync(path.join(RADICE, "public", "loghi", "fondazione-operate.png"));

const DOCUMENTI = {
  manuale: {
    sorgente: "docs/manuale-utente.md",
    uscita: "public/manuali",
    nome: "Manuale_Utente_Portale_CWP",
    titolo: "MANUALE UTENTE",
    breve: "Manuale Utente",
    sottotitolo: "Guida passo per passo per Comuni, enti e soggetti gestori",
    destinatari: "Comuni, enti locali e soggetti gestori aderenti al Programma",
    numeraCapitoli: true,
    nota: (r) => `Questo documento descrive il portale alla revisione ${r.rev} del ${r.data}. A ogni modifica del portale il manuale viene aggiornato e la revisione incrementata; la versione corrente si scarica dal portale.`,
  },
  registro: {
    sorgente: "docs/REGISTRO_DEV_DEPLOY.md",
    uscita: "public/documentazione",
    nome: "Registro_Dev_Deploy_Portale_CWP",
    titolo: "REGISTRO SVILUPPO E DEPLOY",
    breve: "Registro sviluppo e deploy",
    sottotitolo: "Architettura, servizi, database, funzionalità, cronologia dei rilasci",
    destinatari: "Amministratori del portale — documento riservato",
    numeraCapitoli: false,
    nota: (r) => `Fotografia del registro alla revisione ${r.rev} del ${r.data}. Il registro è aggiornato a ogni nuova funzione, servizio o rilascio; la versione corrente si scarica dall'area Documentazione del portale (solo Amministratori).`,
  },
};

const VERDE = "2F5D3A", VERDE_CHIARO = "E4EDE1", INK = "1B2118", GRAFITE = "5A5E54", LINEA = "D9D4C5", CARTA = "F6F4EE";
const FONT = "Arial";
const LARGHEZZA = 11906 - 2 * 1134; // A4, margini 2 cm → 9638 DXA

// ---------- lettura del markdown ----------
// Restituisce { premessa: righe prima del primo "## ", capitoli: [{titolo, righe}] }.
function leggi(file) {
  const testo = fs.readFileSync(path.join(RADICE, file), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const premessa = [];
  const capitoli = [];
  let corrente = null;
  for (const riga of testo.split("\n")) {
    const h = /^## (.+)$/.exec(riga);
    if (h) {
      corrente = { titolo: h[1].trim(), righe: [] };
      capitoli.push(corrente);
    } else if (corrente) corrente.righe.push(riga);
    else if (!/^# /.test(riga)) premessa.push(riga);
  }
  return { premessa, capitoli };
}

const SPECIALE = /^(\||- |\d+\. |```|> ?|### |---\s*$)/;

// Blocchi: paragrafo, sottotitolo, elenchi, tabella, codice, riquadro.
function blocchi(righe) {
  const out = [];
  let i = 0;
  const continua = (testo) => {
    // righe successive rientrate = continuazione della voce
    while (i < righe.length && /^\s{2,}\S/.test(righe[i]) && !/^\s*(- |\d+\. )/.test(righe[i])) testo += " " + righe[i++].trim();
    return testo;
  };
  while (i < righe.length) {
    const r = righe[i];
    if (!r.trim() || /^---\s*$/.test(r)) { i++; continue; }
    if (/^```/.test(r)) {
      const codice = [];
      i++;
      while (i < righe.length && !/^```/.test(righe[i])) codice.push(righe[i++]);
      i++;
      out.push({ tipo: "codice", righe: codice });
      continue;
    }
    if (/^> ?/.test(r)) {
      const dentro = [];
      while (i < righe.length && /^> ?/.test(righe[i])) dentro.push(righe[i++].replace(/^> ?/, ""));
      out.push({ tipo: "riquadro", blocchi: blocchi(dentro) });
      continue;
    }
    if (/^### /.test(r)) { out.push({ tipo: "sottotitolo", testo: r.slice(4).trim() }); i++; continue; }
    if (/^\|/.test(r)) {
      const t = [];
      while (i < righe.length && /^\|/.test(righe[i])) t.push(righe[i++]);
      const celle = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      out.push({ tipo: "tabella", intestazione: celle(t[0]), righe: t.slice(2).map(celle) });
      continue;
    }
    if (/^- /.test(r)) {
      // voci di primo livello ("- ") e di secondo livello (rientrate, "    - ")
      const v = [];
      while (i < righe.length && /^(\s{2,})?- /.test(righe[i])) {
        const livello = /^\s{2,}- /.test(righe[i]) ? 1 : 0;
        const t = righe[i++].replace(/^\s*- /, "");
        v.push({ testo: continua(t), livello });
      }
      out.push({ tipo: "puntato", voci: v });
      continue;
    }
    if (/^\d+\. /.test(r)) {
      const v = [];
      while (i < righe.length && /^\d+\. /.test(righe[i])) { const t = righe[i++].replace(/^\d+\. /, ""); v.push(continua(t)); }
      out.push({ tipo: "numerato", voci: v });
      continue;
    }
    const p = [];
    while (i < righe.length && righe[i].trim() && !SPECIALE.test(righe[i])) p.push(righe[i++].trim());
    out.push({ tipo: "paragrafo", testo: p.join(" ") });
  }
  return out;
}

// Testo con **grassetto**, *corsivo*, `codice`, [link](url), indirizzi web.
function runs(testo, base = {}) {
  const out = [];
  const re = /(~~[^~]+~~|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)|]+)/g;
  let ultimo = 0, m;
  const semplice = (t, extra = {}) => new TextRun({ text: t, font: FONT, color: INK, ...base, ...extra });
  const link = (t, url) => new ExternalHyperlink({ link: url, children: [new TextRun({ text: t, font: FONT, color: VERDE, underline: {}, ...base })] });
  while ((m = re.exec(testo))) {
    if (m.index > ultimo) out.push(semplice(testo.slice(ultimo, m.index)));
    const s = m[0];
    if (s.startsWith("~~")) out.push(...runs(s.slice(2, -2), { ...base, strike: true, color: GRAFITE }));
    else if (s.startsWith("**")) out.push(semplice(s.slice(2, -2), { bold: true }));
    else if (s.startsWith("`")) out.push(semplice(s.slice(1, -1), { font: "Consolas", color: VERDE }));
    else if (s.startsWith("[")) { const [, t, url] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s); out.push(link(t, url)); }
    else if (s.startsWith("http")) out.push(link(s, s));
    else out.push(semplice(s.slice(1, -1), { italics: true }));
    ultimo = m.index + s.length;
  }
  if (ultimo < testo.length) out.push(semplice(testo.slice(ultimo)));
  return out;
}

// ---------- elementi grafici ----------
const bordoSottile = { style: BorderStyle.SINGLE, size: 4, color: LINEA };
const bordi = { top: bordoSottile, bottom: bordoSottile, left: bordoSottile, right: bordoSottile };
const spazio = (dopo = 120) => new Paragraph({ spacing: { after: dopo }, children: [] });

function larghezzeColonne(intestazione, righe) {
  const n = intestazione.length;
  // peso di ogni colonna: metà testo più lungo, metà testo medio (min 11, max 60)
  const pesi = intestazione.map((h, j) => {
    const l = righe.map((r) => (r[j] || "").replace(/[*`]/g, "").length);
    const max = Math.max(h.length, ...l), media = l.length ? l.reduce((a, b) => a + b, 0) / l.length : h.length;
    return Math.min(Math.max(0.5 * max + 0.5 * Math.max(media, h.length), 11), 60);
  });
  // nessuna colonna più stretta della sua parola più lunga (le parole non vanno spezzate)
  let minimi = intestazione.map((h, j) => {
    const parole = [h, ...righe.map((r) => r[j] || "")].join(" ").replace(/[*`]/g, "").split(/\s+/);
    return Math.min(Math.max(...parole.map((x) => x.length)) * 125 + 260, LARGHEZZA / 3);
  });
  const sommaMin = minimi.reduce((a, b) => a + b, 0);
  if (sommaMin > 0.9 * LARGHEZZA) minimi = minimi.map((m) => (m * 0.9 * LARGHEZZA) / sommaMin);
  // colonne fissate al minimo; il resto diviso in proporzione ai pesi
  const fisse = new Set();
  let w;
  for (let giro = 0; giro <= n; giro++) {
    const resto = LARGHEZZA - [...fisse].reduce((a, j) => a + minimi[j], 0);
    const pesoLiberi = pesi.reduce((a, p, j) => a + (fisse.has(j) ? 0 : p), 0);
    w = pesi.map((p, j) => (fisse.has(j) ? minimi[j] : (p / pesoLiberi) * resto));
    const nuove = w.map((x, j) => j).filter((j) => !fisse.has(j) && w[j] < minimi[j]);
    if (!nuove.length) break;
    nuove.forEach((j) => fisse.add(j));
  }
  w = w.map((x) => Math.round(x));
  w[n - 1] += LARGHEZZA - w.reduce((a, b) => a + b, 0);
  return w;
}

function tabella(intestazione, righe, larghezze) {
  const senzaTesta = intestazione.every((h) => !h);
  const w = larghezze || larghezzeColonne(intestazione, righe);
  const cella = (testo, j, testa, pari) =>
    new TableCell({
      width: { size: w[j], type: WidthType.DXA },
      borders: bordi,
      shading: testa ? { fill: VERDE, type: ShadingType.CLEAR, color: "auto" } : pari ? { fill: CARTA, type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: testa ? [new TextRun({ text: testo, bold: true, color: "FFFFFF", font: FONT, size: 18 })] : runs(testo, { size: 18 }) })],
    });
  const corpo = righe.map((r, i) => new TableRow({ cantSplit: true, children: intestazione.map((_, j) => cella(r[j] || "", j, false, i % 2 === 1)) }));
  return new Table({
    width: { size: LARGHEZZA, type: WidthType.DXA },
    columnWidths: w,
    layout: TableLayoutType.FIXED,
    rows: senzaTesta ? corpo : [new TableRow({ tableHeader: true, children: intestazione.map((h, j) => cella(h, j, true)) }), ...corpo],
  });
}

// ---------- contenuto ----------
let istanza = 0;
function rendi(bl, opz = {}) {
  const out = [];
  const rientro = opz.riquadro ? { left: 240 } : undefined;
  const riquadro = opz.riquadro
    ? { border: { left: { style: BorderStyle.SINGLE, size: 18, color: VERDE, space: 8 } }, shading: { fill: VERDE_CHIARO, type: ShadingType.CLEAR, color: "auto" } }
    : {};
  for (const b of bl) {
    if (b.tipo === "paragrafo") out.push(new Paragraph({ ...riquadro, indent: rientro, spacing: { after: 140, line: 300 }, children: runs(b.testo, { size: 21 }) }));
    else if (b.tipo === "sottotitolo")
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: b.testo, font: FONT, bold: true, size: 25, color: VERDE })] }));
    else if (b.tipo === "puntato")
      b.voci.forEach((v) => out.push(new Paragraph({ ...riquadro, numbering: { reference: "punti", level: v.livello || 0 }, spacing: { after: 70, line: 290 }, children: runs(v.testo ?? v, { size: v.livello ? 20 : 21 }) })));
    else if (b.tipo === "numerato") {
      istanza++;
      b.voci.forEach((v) => out.push(new Paragraph({ ...riquadro, numbering: { reference: "numeri", level: 0, instance: istanza }, spacing: { after: 70, line: 290 }, children: runs(v, { size: 21 }) })));
      out.push(spazio(60));
    } else if (b.tipo === "tabella") {
      out.push(tabella(b.intestazione, b.righe));
      out.push(spazio(160));
    } else if (b.tipo === "codice") {
      b.righe.forEach((l, k) =>
        out.push(new Paragraph({
          shading: { fill: CARTA, type: ShadingType.CLEAR, color: "auto" },
          spacing: { before: k === 0 ? 60 : 0, after: k === b.righe.length - 1 ? 200 : 0, line: 220 },
          children: [new TextRun({ text: l.replace(/ /g, " ") || " ", font: "Consolas", size: 14, color: INK })],
        }))
      );
    } else if (b.tipo === "riquadro") {
      out.push(...rendi(b.blocchi, { riquadro: true }));
      out.push(spazio(120));
    }
  }
  return out;
}

const etichetta = (cfg, n, cap) => (cfg.numeraCapitoli ? `${n}. ${cap.titolo}` : cap.titolo);

function capitolo(cfg, n, cap) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { before: 0, after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 6 } },
      children: [new Bookmark({ id: `cap${n}`, children: [new TextRun({ text: etichetta(cfg, n, cap), font: FONT, bold: true, size: 34, color: VERDE })] })],
    }),
    ...rendi(blocchi(cap.righe)),
  ];
}

function copertina(cfg, rev) {
  const info = [
    ["Documento", `${cfg.breve} — Portale Carbon WastePrint`],
    ["Destinatari", cfg.destinatari],
    ["Revisione", `Rev. ${rev.rev}`],
    ["Data di revisione", rev.data],
    ["Redatto da", "Fondazione Operate"],
  ];
  const w = [2600, LARGHEZZA - 2600];
  const cella = (testo, j) =>
    new TableCell({
      width: { size: w[j], type: WidthType.DXA },
      borders: bordi,
      shading: j === 0 ? { fill: VERDE_CHIARO, type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 90, bottom: 90, left: 140, right: 140 },
      children: [new Paragraph({ children: [new TextRun({ text: testo, bold: j === 0, font: FONT, size: 20, color: j === 0 ? VERDE : INK })] })],
    });
  return [
    new Paragraph({ spacing: { before: 900, after: 200 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: LOGO_CWP, transformation: { width: 300, height: 186 } })] }),
    new Paragraph({ spacing: { before: 500, after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: cfg.titolo, font: FONT, bold: true, size: cfg.titolo.length > 20 ? 46 : 56, color: VERDE, characterSpacing: 40 })] }),
    new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Portale Carbon WastePrint®", font: FONT, size: 32, color: INK })] }),
    new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 12 } }, children: [new TextRun({ text: cfg.sottotitolo, font: FONT, italics: true, size: 24, color: GRAFITE })] }),
    new Table({ width: { size: LARGHEZZA, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, rows: info.map(([a, b]) => new TableRow({ children: [cella(a, 0), cella(b, 1)] })) }),
    new Paragraph({ spacing: { before: 2600, after: 80 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Programma di", font: FONT, size: 18, color: GRAFITE })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: LOGO_FO, transformation: { width: 200, height: 72 } })] }),
  ];
}

function pagineIniziali(cfg, revisioni, rev, sorgente, pagine) {
  const titolo = (t) => new Paragraph({ spacing: { before: 0, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 6 } }, children: [new TextRun({ text: t, font: FONT, bold: true, size: 30, color: VERDE })] });
  const tabRev = tabella(["Rev.", "Data", "Descrizione", "Autore"], revisioni.slice().reverse().map((r) => [r.rev, r.data, r.descrizione, r.autore]), [800, 1300, LARGHEZZA - 800 - 1300 - 2000, 2000]);
  const voci = sorgente.capitoli.map((c, i) =>
    new Paragraph({
      spacing: { after: 130 },
      tabStops: [{ type: TabStopType.RIGHT, position: LARGHEZZA, leader: LeaderType.DOT }],
      children: [
        new InternalHyperlink({
          anchor: `cap${i + 1}`,
          children: [
            new TextRun({ text: cfg.numeraCapitoli ? `${i + 1}.  ${c.titolo}` : c.titolo, font: FONT, size: 22, color: INK }),
            new TextRun({ children: [new Tab(), pagine ? String(pagine[i] ?? "") : ""], font: FONT, size: 22, color: INK }),
          ],
        }),
      ],
    })
  );
  const premessa = rendi(blocchi(sorgente.premessa).filter((b) => b.tipo !== "tabella"));
  return [
    titolo("Registro delle revisioni"),
    tabRev,
    spazio(200),
    new Paragraph({ spacing: { after: 160 }, children: runs(cfg.nota(rev), { size: 20, color: GRAFITE }) }),
    ...premessa,
    new Paragraph({ children: [new PageBreak()] }),
    titolo("Sommario"),
    ...voci,
  ];
}

function intestazione(cfg, rev) {
  return new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINEA, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: LARGHEZZA }],
        children: [
          new ImageRun({ type: "png", data: LOGO_CWP, transformation: { width: 58, height: 36 } }),
          new TextRun({ children: [new Tab(), `${cfg.breve} · Rev. ${rev.rev} · ${rev.data}`], font: FONT, size: 16, color: GRAFITE }),
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

function documento(cfg, revisioni, sorgente, pagine) {
  istanza = 0;
  const rev = revisioni[revisioni.length - 1];
  const pagina = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 567, footer: 567 } } };
  const conTesta = { properties: pagina, headers: { default: intestazione(cfg, rev) }, footers: { default: pieDiPagina() } };
  return new Document({
    creator: "Fondazione Operate",
    title: `${cfg.breve} — Portale Carbon WastePrint (Rev. ${rev.rev})`,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: INK } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 34, bold: true, color: VERDE }, paragraph: { outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 25, bold: true, color: VERDE }, paragraph: { outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "punti",
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } }, run: { color: VERDE } } },
            { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } }, run: { color: VERDE } } },
          ],
        },
        { reference: "numeri", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } }, run: { bold: true, color: VERDE } } }] },
      ],
    },
    sections: [
      { properties: pagina, children: copertina(cfg, rev) },
      { ...conTesta, children: pagineIniziali(cfg, revisioni, rev, sorgente, pagine) },
      { ...conTesta, children: sorgente.capitoli.flatMap((c, i) => capitolo(cfg, i + 1, c)) },
    ],
  });
}

// Pagine dei capitoli lette dal PDF della prima passata, per il sommario.
function paginePdf(cfg, pdf, capitoli) {
  const pagine = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" }).split("\f");
  const inizio = pagine.findIndex((p) => /Sommario/.test(p)) + 1;
  return capitoli.map((c, i) => {
    const cercato = etichetta(cfg, i + 1, c).replace(/\s+/g, " ");
    const idx = pagine.findIndex((p, k) => k >= inizio && p.split("\n").some((l) => l.trim().replace(/\s+/g, " ") === cercato));
    return idx >= 0 ? idx + 1 : null;
  });
}

function aPdf(docx, dir) {
  try {
    execFileSync(process.env.SOFFICE || "soffice", ["--headless", "--convert-to", "pdf", "--outdir", dir, docx], { stdio: "ignore" });
    return docx.replace(/\.docx$/, ".pdf");
  } catch {
    return null;
  }
}

async function genera(chiave) {
  const cfg = DOCUMENTI[chiave];
  const revisioni = REVISIONI[chiave];
  const sorgente = leggi(cfg.sorgente);
  const dir = path.join(RADICE, cfg.uscita);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${cfg.nome}.docx`);
  fs.writeFileSync(file, await Packer.toBuffer(documento(cfg, revisioni, sorgente, null)));
  const pdf = aPdf(file, dir);
  let pagine = null;
  if (pdf) {
    pagine = paginePdf(cfg, pdf, sorgente.capitoli);
    fs.writeFileSync(file, await Packer.toBuffer(documento(cfg, revisioni, sorgente, pagine)));
    aPdf(file, dir);
  }
  // PDF tipografico (copertina a tutta pagina, aperture di capitolo, riquadri):
  // sostituisce quello convertito da LibreOffice, se WeasyPrint è disponibile.
  try {
    execFileSync("python3", [path.join(__dirname, "impagina_pdf.py"), chiave], { stdio: "ignore" });
    console.log(`  PDF impaginato con strumenti/impagina_pdf.py`);
  } catch {
    console.log("  (WeasyPrint non disponibile: resta il PDF di LibreOffice)");
  }
  const rev = revisioni[revisioni.length - 1];
  console.log(`${cfg.breve}: Rev. ${rev.rev} del ${rev.data} → ${cfg.uscita}/${cfg.nome}.docx${pdf ? " + .pdf" : " (nessun PDF: LibreOffice assente)"}`);
  if (pagine) console.log("  sommario:", pagine.map((p, i) => `${i + 1}→${p ?? "?"}`).join(" "));
}

(async () => {
  const scelti = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DOCUMENTI);
  for (const k of scelti) {
    if (!DOCUMENTI[k]) throw new Error(`Documento sconosciuto: ${k} (usa: ${Object.keys(DOCUMENTI).join(", ")})`);
    await genera(k);
  }
})();
