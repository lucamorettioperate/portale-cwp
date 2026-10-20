/* =========================================================================
   genera_presentazione.cjs — presentazione PowerPoint «Portale Carbon
   WastePrint: stato dei lavori e recap»

   Scopo: produce la presentazione di riepilogo del portale (metodologia,
     funzioni, novità, architettura, ruoli, punti aperti, simulatore, piani
     a pagamento, scelte da prendere). Per regola di Luca (19/10/2026) si
     aggiorna a ogni rilascio insieme agli altri documenti ed è disponibile
     agli Amministratori nella pagina Documentazione.
   Uscita: public/documentazione/Presentazione_Portale_CWP.pptx e, se è
     installato LibreOffice (comando soffice), anche il .pdf accanto.
   Dati letti da soli: data di oggi (ora italiana), revisione della voce
     «presentazione» in strumenti/revisioni_documenti.json, numero di
     versioni pubblicate (git), script del database (supabase/NN_*.sql),
     righe di codice dall'inventario del Registro; immagini in
     strumenti/presentazione/immagini (schermate con dati di prova o dati
     pubblici ISPRA).
   Uso (dalla cartella del repository):
     npm install --no-save pptxgenjs sharp react-icons
     node strumenti/presentazione/genera_presentazione.cjs
   (le librerie non sono nel package.json per non appesantire la build del
   portale su Vercel). Il tema colori del file si applica se è disponibile
   lo script apply_theme.js della skill pptx (variabile PPTX_APPLY_THEME o
   percorso predefinito); altrimenti si salta, con un avviso.
   Registro sviluppo e deploy: capitolo 8 «Procedure di rilascio».
   ========================================================================= */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const fa = require("react-icons/fa");
// React dalla stessa installazione di react-icons: quello del portale può
// avere un'altra versione e le icone non si disegnerebbero.
const vicinoIcone = { paths: [path.dirname(require.resolve("react-icons/fa"))] };
const React = require(require.resolve("react", vicinoIcone));
const RDS = require(require.resolve("react-dom/server", vicinoIcone));

// Tema colori (facoltativo): script apply_theme.js della skill pptx.
let applyTheme = null;
for (const p of [process.env.PPTX_APPLY_THEME, "/root/.claude/skills/synced/de1e0ede-7610-45b3-9ab6-e8761f36fed6_624c5250-9f8d-49cb-80e6-5f1c0d0237aa/pptx/scripts/apply_theme.js"].filter(Boolean)) {
  if (fs.existsSync(p)) { applyTheme = require(p).applyTheme; break; }
}

const RADICE = path.resolve(__dirname, "..", "..");
const LOGHI = path.join(RADICE, "public", "loghi") + "/";
const IMMAGINI = path.join(__dirname, "immagini") + "/";
// Data di oggi in ora italiana (es. «19 ottobre 2026») e revisione.
const OGGI = new Date().toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric" });
const REVISIONI = JSON.parse(fs.readFileSync(path.join(RADICE, "strumenti", "revisioni_documenti.json"), "utf8")).presentazione || [];
const REV = REVISIONI[REVISIONI.length - 1] || { rev: "1.0", data: OGGI };
// Righe di codice dall'inventario del Registro (arrotondate alle centinaia).
const reg = fs.readFileSync(path.join(RADICE, "docs", "REGISTRO_DEV_DEPLOY.md"), "utf8");
const righeInv = Number((reg.match(/file, ([\d.]+) righe in tutto/) || [0, "0"])[1].replace(/\./g, ""));
const RIGHE = "≈" + (Math.round(righeInv / 100) * 100).toLocaleString("it-IT");
// Contatori letti dal repository: versioni pubblicate (commit) e script del database.
const VERSIONI = execSync(`git -C "${RADICE}" rev-list --count HEAD`).toString().trim();
const SCRIPT = String(fs.readdirSync(path.join(RADICE, "supabase")).filter((f) => /^\d\d_.*\.sql$/.test(f)).length);
const FUNZIONI = String(fs.readdirSync(path.join(RADICE, "supabase", "functions")).filter((f) => fs.statSync(path.join(RADICE, "supabase", "functions", f)).isDirectory()).length);
const OUT = path.join(RADICE, "public", "documentazione", "Presentazione_Portale_CWP.pptx");

const HEX = { verde: "2F5D3A", verdeChiaro: "E4EDE1", ocra: "B06A2F", ocraChiaro: "F6E9DA", ink: "1B2118", grafite: "5A5E54", linea: "D9D4C5", bianco: "FFFFFF", rosso: "A23B2C", grigio: "F1F3EF" };
const THEME = {
  name: "Carbon WastePrint",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: HEX.ink, lt1: HEX.bianco, dk2: HEX.verde, lt2: HEX.grigio,
    accent1: HEX.verde, accent2: HEX.ocra, accent3: HEX.verdeChiaro, accent4: HEX.ocraChiaro,
    accent5: HEX.rosso, accent6: HEX.grafite, hlink: HEX.verde, folHlink: HEX.ocra,
  },
};

async function icona(Comp, colore) {
  const svg = RDS.renderToStaticMarkup(React.createElement(Comp, { color: "#" + colore, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = "Portale Carbon WastePrint — stato dei lavori e recap";
  pres.author = "Fondazione Operate";
  pres.company = "Fondazione Operate";
  const C = pres.SchemeColor;
  const W = 13.333;

  // Layout: copertina e contenuto (titolo, piè di pagina, numero di pagina).
  pres.defineSlideMaster({
    title: "COPERTINA",
    background: { color: C.background1 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.35, w: 7.4, h: 1.8, fontFace: "Cambria", fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "Titolo" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.35, w: 7.4, h: 1.2, fontSize: 18, color: C.accent3, valign: "top", margin: 0 }, text: "Sottotitolo" } },
    ],
  });
  pres.defineSlideMaster({
    title: "CONTENUTO",
    background: { color: C.background1 },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 10.0, h: 0.8, fontFace: "Cambria", fontSize: 30, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "Titolo" } },
      // Loghi piccoli in alto a destra (Carbon WastePrint e Fondazione Operate)
      { image: { path: LOGHI + "carbonwasteprint.png", x: 10.83, y: 0.36, w: 0.8, h: 0.8 * 248 / 400 } },
      { image: { path: LOGHI + "fondazione-operate.png", x: 11.73, y: 0.49, w: 1.0, h: 1.0 * 287 / 800 } },
      { text: { text: `Portale Carbon WastePrint · Stato dei lavori e recap · ${OGGI} · rev. ${REV.rev}`, options: { x: 0.6, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: C.accent6, align: "right" },
  });

  const card = (s, x, y, w, h, fill = C.background2, nome) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }, objectName: nome });
  const cerchio = (s, x, y, d, colore, img, nome) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: colore }, line: { color: colore }, objectName: nome + " cerchio" });
    s.addImage({ data: img, x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5, objectName: nome + " icona" });
  };

  const ic = {};
  for (const [k, comp] of Object.entries({
    org: fa.FaBuilding, fasi: fa.FaStream, doc: fa.FaFileAlt, integr: fa.FaExchangeAlt, consult: fa.FaUsers,
    pag: fa.FaEuroSign, notif: fa.FaBell, cruscotto: fa.FaTachometerAlt, crediti: fa.FaLeaf, audit: fa.FaHistory,
    fascicolo: fa.FaFileArchive, conserva: fa.FaArchive, utenti: fa.FaUserShield, manuali: fa.FaBook,
    scudo: fa.FaShieldAlt, server: fa.FaServer, puzzle: fa.FaPuzzlePiece, robot: fa.FaRobot, grafico: fa.FaChartLine,
  })) ic[k] = await icona(comp, HEX.bianco);

  // ---------------------------------------------------------------- Copertina
  pres.addSection({ title: "Apertura" });
  let s = pres.addSlide({ masterName: "COPERTINA", sectionTitle: "Apertura" });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 8.9, h: 7.5, fill: { color: C.text2 }, line: { color: C.text2 }, objectName: "Pannello verde" });
  s.addText("Portale Carbon WastePrint", { placeholder: "title" });
  s.addText(`Stato dei lavori e recap: metodologia, funzioni, novità, punti aperti e scelte da prendere · aggiornata al ${OGGI} · rev. ${REV.rev}`, { placeholder: "body" });
  s.addText("FONDAZIONE OPERATE · PROGRAMMA CARBON WASTEPRINT®", { x: 0.8, y: 0.7, w: 7.4, h: 0.4, fontSize: 12, bold: true, color: C.accent3, charSpacing: 2, margin: 0, isTextBox: true });
  s.addImage({ path: LOGHI + "carbonwasteprint.png", x: 9.55, y: 1.9, w: 3.2, h: 3.2 * 248 / 400, objectName: "Logo Carbon WastePrint" });
  s.addImage({ path: LOGHI + "fondazione-operate.png", x: 9.55, y: 4.3, w: 3.2, h: 3.2 * 287 / 800, objectName: "Logo Fondazione Operate" });
  s.addNotes(`Presentazione di riepilogo del portale, aggiornata al ${OGGI} (revisione ${REV.rev}): metodologia, funzioni realizzate, novità, punti aperti di sviluppo e scelte ancora da prendere. Si rigenera a ogni rilascio insieme agli altri documenti ed è disponibile agli Amministratori nella pagina Documentazione del portale.`);

  // ---------------------------------------------------------------- 1. Metodologia
  pres.addSection({ title: "Metodologia" });
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Metodologia" });
  s.addText("La metodologia CWP in sintesi", { placeholder: "title" });
  s.addText("Il Programma trasforma in crediti di carbonio la CO₂eq evitata dai comportamenti virtuosi delle utenze, misurati uno per uno (Metodologia CWP v1.2, conforme a UNI EN ISO 14064-2:2019).", { x: 0.6, y: 1.2, w: 12.1, h: 0.5, fontSize: 15, color: C.accent6, margin: 0, isTextBox: true });
  // Formula: attese − progetto = lordi → buffer → netti
  const fy = 1.85, fh = 1.4;
  const blocchi = [
    { x: 0.6, w: 2.75, t: "Emissioni attese (EA)", d: "Scenario di riferimento: rifiuti dell'anno (Catasto ISPRA) ripartiti per classe di utenza (delibera TARI)", f: C.background2, c: C.text1 },
    { x: 3.85, w: 2.75, t: "Emissioni di progetto (EP)", d: "Dai conferimenti misurati di ogni utenza (Banca Dati Utenze), ex post", f: C.background2, c: C.text1 },
    { x: 7.1, w: 2.5, t: "Crediti lordi", d: "ΔI = EP − EA: se negativa, la riduzione in tCO₂eq (formule 31-32)", f: C.accent3, c: C.text2 },
    { x: 10.1, w: 2.6, t: "Crediti netti", d: "Lordi meno il buffer cautelativo (Cap. 7, massimo 80%)", f: C.text2, c: C.background1 },
  ];
  blocchi.forEach((b, i) => {
    card(s, b.x, fy, b.w, fh, b.f, "Formula " + b.t);
    s.addText([
      { text: b.t, options: { bold: true, fontSize: 18, color: b.c, breakLine: true } },
      { text: b.d, options: { fontSize: 13, color: b.c } },
    ], { x: b.x + 0.2, y: fy + 0.15, w: b.w - 0.4, h: fh - 0.3, valign: "middle", margin: 0, paraSpaceAfter: 6, isTextBox: true });
  });
  [["−", 3.35], ["=", 6.6], ["→", 9.6]].forEach(([op, x]) =>
    s.addText(op, { x, y: fy, w: 0.5, h: fh, fontSize: 30, bold: true, color: C.accent2, align: "center", valign: "middle", margin: 0, isTextBox: true }));
  // Tre schede: dati, percorso, attori
  const sy = 3.5, sh = 3.3, sw = 3.83;
  const schede = [
    { t: "Condizioni e buffer", r: ["Anno di riferimento con differenziata al 65% ±1% (Catasto ISPRA) o media del cluster", "Addizionalità normativa, tecnica (almeno l'indifferenziato misurato) ed economica (CUE < FS + 30%)", "Buffer: utenze monitorate + rifiuti misurati (30% col solo indifferenziato) + 20% se si contano solo le virtuose; massimo 80%, dimezzato con tariffa puntuale"] },
    { t: "Il percorso", r: ["Registrazione del progetto: 150 giorni, con feedback pubblico di 30 giorni; il progetto inizia da «progetto registrato»", "Poi un Rapporto di Monitoraggio per anno solare (feedback pubblico 20 giorni, verifica dell'ente), per tutto il periodo: 10 anni o 7 per 3 volte", "Letture valide almeno al 70% (50% con penali al gestore)"] },
    { t: "Chi partecipa", r: ["Promotore del progetto (Comune, EGATO o gestore): presenta progetto e Rapporti, è titolare dei crediti", "Promotore del programma: Fondazione Operate, in esclusiva da Wastelab (gestione commerciale e portale CWP)", "Ente di validazione e verifica (ISO 14065 o 17029)", "Stakeholders: feedback pubblico; registri esterni: vendita dei crediti"] },
  ];
  schede.forEach((sc, i) => {
    const x = 0.6 + i * (sw + 0.3);
    card(s, x, sy, sw, sh, C.background2, "Scheda " + sc.t);
    s.addText(sc.t, { x: x + 0.25, y: sy + 0.18, w: sw - 0.5, h: 0.4, fontSize: 17, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(sc.r.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < sc.r.length - 1 } })),
      { x: x + 0.25, y: sy + 0.62, w: sw - 0.45, h: sh - 0.75, fontSize: 13, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true });
  });
  s.addNotes("Metodologia CWP v1.2 (Wastelab e Altraleonia, 04/09/2025), validata da RINA nel 2018 e nel 2020; la versione attuale fa riferimento alla UNI EN ISO 14064-2:2019. I crediti devono essere reali, misurabili, addizionali, verificati, univoci e trasparenti; i ricavi vanno reinvestiti nella gestione dei rifiuti e tracciati nel PEF (Standard 4.9.3). Soggetto promotore del programma (Guida 3.1): lo Studio Associato Wastelab, proprietario del Programma, ha conferito in esclusiva a Fondazione Operate, con accordi legali e commerciali, la gestione sia della parte commerciale sia della parte tecnologica (portale CWP). Il progetto parte dalla data di «progetto registrato» (Standard 4.5); se non presenta Rapporti entro due anni si avvia l'iter della Guida 6.4.1. Le emissioni attese (EA) vengono dai rifiuti dell'anno di riferimento (Catasto ISPRA) ripartiti per classe di utenza con i coefficienti Kb e Kd della delibera TARI; le emissioni di progetto (EP) dai conferimenti misurati di ogni utenza. ΔI = EP − EA, per utenza e per il territorio: se negativa è credito. Il buffer (Capitolo 7) è la somma di più quote: utenze monitorate (Tabella 15, fino al 30% più fino al 10% per categorie non domestiche non monitorate), rifiuti misurati (Tabella 16, dal 3% al 30%, con riduzioni del 2% e dell'1%), 20% di default se si contano solo le utenze virtuose; massimo 80%, dimezzato dall'anno in cui è attiva la tariffa puntuale. La componente trasporto (Capitolo 9) è facoltativa: i fattori WARM la includono già. Non sono previsti fenomeni di leakage. Monitoraggio annuale sulla Banca Dati Utenze, responsabile il gestore delle tariffe; letture valide almeno al 70% (50% se il contratto prevede penali al gestore), anomalie tollerate fino al 15%.");

  // ---------------------------------------------------------------- 2-3. Analisi funzionale
  pres.addSection({ title: "Analisi funzionale" });
  const griglia = (s, voci, cols, x0, y0, wTot, h, gap = 0.3) => {
    const w = (wTot - gap * (cols - 1)) / cols;
    const comp = h < 2; // schede basse: icona e testo più piccoli
    const d = comp ? 0.42 : 0.55, ty = comp ? 0.62 : 0.92;
    voci.forEach((v, i) => {
      const x = x0 + (i % cols) * (w + gap), y = y0 + Math.floor(i / cols) * (h + gap);
      card(s, x, y, w, h, C.background2, "Scheda " + v.t);
      cerchio(s, x + 0.18, y + 0.14, d, v.colore || C.text2, ic[v.i], v.t);
      s.addText(v.t, { x: x + 0.18 + d + 0.15, y: y + 0.14, w: w - d - 0.5, h: d, fontSize: comp ? 14 : 15, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
      s.addText(v.d, { x: x + 0.2, y: y + ty, w: w - 0.38, h: h - ty - 0.08, fontSize: comp ? 12 : 13.5, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    });
  };

  // Collegamento al portale online (richiesta di Luca del 19/10).
  const linkPortale = (s) => s.addText([
    { text: "Portale online: ", options: { color: C.accent6 } },
    { text: "portale-cwp.vercel.app", options: { color: C.text2, bold: true, hyperlink: { url: "https://portale-cwp.vercel.app", tooltip: "Apri il portale" } } },
    { text: "   ·   pagina pubblica: ", options: { color: C.accent6 } },
    { text: "portale-cwp.vercel.app/programma", options: { color: C.text2, bold: true, hyperlink: { url: "https://portale-cwp.vercel.app/programma", tooltip: "Apri la pagina pubblica del Programma" } } },
  ], { x: 0.6, y: 1.02, w: 12.1, h: 0.3, fontSize: 12, margin: 0, isTextBox: true, objectName: "Collegamento al portale" });
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Analisi funzionale" });
  s.addText("Analisi funzionale (1/2): la gestione delle pratiche", { placeholder: "title" });
  linkPortale(s);
  griglia(s, [
    { i: "org", t: "Anagrafiche", d: "Organizzazioni con 2 delegati e un solo account, Enti di validazione e verifica, Registri" },
    { i: "fasi", t: "Pratiche e fasi", d: "Progetti e Rapporti a 7 fasi (Guida), ID e stato nel Programma, territorio ISTAT, periodo, ritiro e rientro" },
    { i: "doc", t: "Documenti", d: "Versioni mai sovrascritte, impronta, tipologie ufficiali, richiesti per fase; contratto e versione privata mai pubblici" },
    { i: "integr", t: "Integrazioni e verifiche", d: "Richiesta e risposta del Comune; verifica sull'accuratezza (+15 gg) e fino a 3 accertamenti" },
    { i: "consult", t: "Feedback pubblico", d: "Progetti 30 giorni, Rapporti 20; documento bloccato, osservazioni numerate con email confermata, errata corrige" },
    { i: "pag", t: "Pagamenti", d: "Voci e importi dello Schema tariffario; attività sospese fino al saldo; il Comune consulta" },
    { i: "notif", t: "Notifiche e messaggi", d: "Campanella ed email per eventi e scadenze, avviso dopo 2 anni senza Rapporti; messaggi nella pratica" },
    { i: "cruscotto", t: "Dashboard", d: "Barra a LED delle 7 fasi per pratica; in corso, in scadenza, scadute; ricerca, filtri, ogni colonna ordinabile" },
  ], 4, 0.6, 1.5, 12.1, 2.45);
  s.addNotes("Le otto aree del requisito funzionale dedicate alla gestione del percorso del Comune sono tutte realizzate e pubblicate. Il 18 ottobre sera il portale è stato allineato ai documenti ufficiali del Programma (Guida, Standard, Schema tariffario): Rapporto a 7 fasi con feedback di 20 giorni, un solo account per Organizzazione (Guida 7.2), periodo di 10 anni o 7 rinnovabili (fino a 21 Rapporti), stati della Guida (in fase di validazione, in fase di verifica documentale, progetto registrato, progetto ritirato), un solo progetto per territorio (codice ISTAT, Standard 4.6), tariffe con sospensione fino al saldo, verifica sull'accuratezza e accertamenti (Guida 6.5.2). Le durate delle fasi del Progetto (10, 30, 20, 75 e 15 giorni) coincidono con la Tabella 3 della Guida al Programma. Il 19 ottobre: il Cruscotto diventa Dashboard, con una barra a LED delle 7 fasi per ogni pratica (accese le fasi completate, spente quelle da fare, la settima verde), e tutte le tabelle e gli elenchi del portale si ordinano per qualsiasi colonna.");

  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Analisi funzionale" });
  s.addText("Analisi funzionale (2/2): crediti e garanzie", { placeholder: "title" });
  linkPortale(s);
  griglia(s, [
    { i: "crediti", t: "Calcolo dei crediti", colore: C.accent2, d: "Controllo della Fondazione: import del tracciato, privacy, coerenza, qualità dei dati (Tabella 3 ±30%), PDF" },
    { i: "pag", t: "Crediti emessi", colore: C.accent2, d: "ID univoci dopo il Rapporto registrato; registro esterno, vendite, cancellazione: attivo / ritirato" },
    { i: "consult", t: "Piattaforma pubblica", d: "Enti, registri, metodologie, modulistica, progetti con documenti pubblici e crediti" },
    { i: "notif", t: "Reclami", d: "Invio dal portale o via PEC; gestore, conferma, risposta scritta, costi; notifiche" },
    { i: "audit", t: "Audit trail", d: "Ogni operazione registrata dal database con autore, prima e dopo, motivazione" },
    { i: "fascicolo", t: "Fascicolo", d: "ZIP con riepilogo PDF, versioni, validazione, feedback, note, messaggi, storico" },
    { i: "conserva", t: "Conservazione", d: "Nessuna cancellazione; 12 anni dalla chiusura o dal ritiro (Guida 6.2.1)" },
    { i: "utenti", t: "Accesso e utenti", d: "Più amministratori, uno principale protetto; credenziali via email; utenti mai attivi eliminabili" },
    { i: "manuali", t: "Documentazione", d: "4 manuali, Istruzioni di ripristino e questa presentazione, sempre aggiornati; codice commentato" },
  ], 3, 0.6, 1.45, 8.5, 1.62, 0.18);
  // Numeri chiave
  const numeri = [[SCRIPT, "script del database"], [FUNZIONI, "funzioni sul server"], ["6", "documenti aggiornati a ogni rilascio"], [RIGHE, "righe di codice commentate"]];
  numeri.forEach(([n, l], i) => {
    const y = 1.45 + i * 1.33;
    card(s, 9.45, y, 3.25, 1.15, i === 0 ? C.text2 : C.accent3, "Numero " + l);
    s.addText(n, { x: 9.65, y: y + 0.08, w: 2.85, h: 0.6, fontSize: 30, bold: true, fontFace: "Cambria", color: i === 0 ? C.background1 : C.text2, margin: 0, isTextBox: true });
    s.addText(l, { x: 9.65, y: y + 0.68, w: 2.85, h: 0.38, fontSize: 13, color: i === 0 ? C.background1 : C.text1, margin: 0, isTextBox: true });
  });
  s.addNotes("Novità del 18 ottobre sera, dai documenti del Programma: crediti emessi con ID univoco dopo la registrazione del Rapporto, caricamento sul registro esterno scelto dal Comune, vendite comunicate dal registro e cancellazione tombale entro 10 giorni (Guida 6.3.3, Standard 6.2); pagina pubblica /programma (Guida 3.7); reclami (Politica di reclamo); controlli della Gestione qualità dei dati. Il calcolo dei crediti è una funzione migliorativa, oltre il perimetro dei requisiti: per la Metodologia il calcolo lo fa il soggetto promotore del progetto nel Rapporto di Monitoraggio e l'ente di validazione e verifica lo verifica; il portale permette alla Fondazione di ricalcolare e controllare. È riservato agli Amministratori: import diretto del file del Comune, controlli, rapporto PDF con impronta e numero progressivo per i calcoli ex post confermati (non è il registro dei crediti, che per lo Standard è una piattaforma esterna di vendita). Le garanzie richieste dai requisiti (audit, fascicolo, conservazione 12 anni, ruoli) sono garantite dal database e non solo dall'interfaccia.");


  // ---------------------------------------------------------------- Effetto «wow»: già online
  pres.addSection({ title: "Già realtà" });
  s = pres.addSlide({ sectionTitle: "Già realtà" });
  s.background = { color: HEX.verde };
  // Cerchi decorativi in trasparenza
  s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 5.6, h: 5.6, fill: { color: HEX.bianco, transparency: 92 }, line: { color: HEX.bianco, transparency: 100 }, objectName: "Decoro cerchio grande" });
  s.addShape(pres.shapes.OVAL, { x: -1.7, y: 6.1, w: 3.0, h: 3.0, fill: { color: HEX.ocra, transparency: 80 }, line: { color: HEX.ocra, transparency: 100 }, objectName: "Decoro cerchio piccolo" });
  s.addText("LO SVILUPPO È QUASI CONCLUSO", { x: 0.8, y: 0.85, w: 8, h: 0.4, fontSize: 15, bold: true, charSpacing: 4, color: HEX.ocraChiaro, margin: 0, isTextBox: true });
  s.addText("Tutto questo\nè già realtà!", { x: 0.8, y: 1.25, w: 8.4, h: 2.3, fontFace: "Cambria", fontSize: 62, bold: true, color: HEX.bianco, valign: "top", margin: 0, lineSpacingMultiple: 0.95, isTextBox: true });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.82, y: 3.62, w: 1.6, h: 0.09, fill: { color: HEX.ocra }, line: { color: HEX.ocra }, objectName: "Linea ocra" });
  s.addText([
    { text: "Insieme a Luca Moretti e con l'ausilio di " },
    { text: "Claude Code", options: { bold: true, color: HEX.bianco } },
    { text: " abbiamo implementato e quasi terminato tutto il sistema." },
  ], { x: 0.8, y: 3.82, w: 8.5, h: 0.8, fontSize: 18, color: HEX.verdeChiaro, valign: "top", margin: 0, isTextBox: true });
  // Servizi in produzione
  s.addText("IN PRODUZIONE", { x: 0.8, y: 4.72, w: 1.6, h: 0.38, fontSize: 11, bold: true, charSpacing: 2, color: HEX.ocraChiaro, valign: "middle", margin: 0, isTextBox: true });
  ["GitHub", "Supabase", "Vercel", "Resend"].forEach((t, i) => {
    const x = 2.4 + i * 1.5;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.72, w: 1.38, h: 0.38, rectRadius: 0.19, fill: { color: HEX.bianco, transparency: 85 }, line: { color: HEX.verdeChiaro, width: 0.75 }, objectName: "Servizio " + t });
    s.addText(t, { x, y: 4.72, w: 1.38, h: 0.38, fontSize: 13, bold: true, color: HEX.bianco, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  s.addText([{ text: "portale-cwp.vercel.app", options: { hyperlink: { url: "https://portale-cwp.vercel.app", tooltip: "Apri il portale" } } }],
    { x: 0.8, y: 5.22, w: 8.4, h: 0.65, fontFace: "Cambria", fontSize: 34, bold: true, color: HEX.ocraChiaro, margin: 0, isTextBox: true });
  s.addText([{ text: "Pagina pubblica del Programma: " }, { text: "portale-cwp.vercel.app/programma", options: { bold: true, hyperlink: { url: "https://portale-cwp.vercel.app/programma", tooltip: "Apri la pagina pubblica" } } }],
    { x: 0.8, y: 5.86, w: 8.4, h: 0.36, fontSize: 14, color: HEX.verdeChiaro, margin: 0, isTextBox: true });
  // Numeri
  const wow = [[VERSIONI, "versioni pubblicate"], [SCRIPT, "script del database"], [FUNZIONI, "funzioni sul server"], [RIGHE, "righe di codice"]];
  wow.forEach(([n, l], i) => {
    const x = 0.8 + i * 2.1;
    s.addText([{ text: n, options: { fontFace: "Cambria", fontSize: 24, bold: true, color: HEX.bianco, breakLine: true } }, { text: l, options: { fontSize: 11.5, color: HEX.verdeChiaro } }],
      { x, y: 6.4, w: 1.95, h: 0.8, valign: "top", margin: 0, isTextBox: true });
  });
  // Loghi su riquadro bianco in alto a destra
  card(s, 10.6, 0.3, 2.15, 0.72, HEX.bianco, "Riquadro loghi");
  s.addImage({ path: LOGHI + "carbonwasteprint.png", x: 10.72, y: 0.41, w: 0.8, h: 0.8 * 248 / 400, objectName: "Logo Carbon WastePrint" });
  s.addImage({ path: LOGHI + "fondazione-operate.png", x: 11.62, y: 0.48, w: 1.0, h: 1.0 * 287 / 800, objectName: "Logo Fondazione Operate" });
  // QR code
  card(s, 9.55, 1.55, 3.2, 4.15, HEX.bianco, "Riquadro QR");
  s.addImage({ path: IMMAGINI + "qr_portale.png", x: 9.8, y: 1.8, w: 2.7, h: 2.7, hyperlink: { url: "https://portale-cwp.vercel.app" }, altText: "Codice QR che apre portale-cwp.vercel.app", objectName: "QR portale" });
  s.addText("Inquadrate il codice\ne provatelo dal telefono", { x: 9.75, y: 4.6, w: 2.8, h: 0.9, fontSize: 14, bold: true, color: HEX.verde, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addNotes(`Pagina «effetto sorpresa»: nessuno si aspetta che il portale sia già online. Il sistema è stato realizzato da Luca Moretti con l'ausilio di Claude Code ed è quasi terminato; i servizi sono già in produzione: GitHub (codice), Vercel (pubblicazione del portale), Supabase (database, utenti, documenti, funzioni) e Resend (email). Il portale è pubblicato su portale-cwp.vercel.app e funziona con dati di prova: si può aprire durante la presentazione (collegamento cliccabile) o inquadrare il codice QR con il telefono. La pagina pubblica /programma mostra già gli 8 documenti ufficiali del Programma, la Metodologia approvata, la PEC e il soggetto promotore. Lo sviluppo del portale vero è partito il 17 ottobre 2026: da allora sono state pubblicate ${VERSIONI} versioni, ${SCRIPT} script del database e ${FUNZIONI} funzioni sul server. Restano i punti aperti delle prossime slide (servizi a pagamento, sicurezza, dati da inserire, collaudo con un Comune). Suggerimento: aprire il portale dal vivo con un utente di prova e mostrare la pagina pubblica.`);


  // ---------------------------------------------------------------- Architettura e ruoli
  pres.addSection({ title: "Architettura e ruoli" });
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Architettura e ruoli" });
  s.addText("Architettura e infrastruttura", { placeholder: "title" });
  const box = (x, y, w, h, fill, titolo, testo, nome, colT = C.text2, colD = C.text1) => {
    card(s, x, y, w, h, fill, nome);
    s.addText([
      { text: titolo, options: { bold: true, fontSize: 14, color: colT, breakLine: !!testo } },
      ...(testo ? [{ text: testo, options: { fontSize: 11.5, color: colD } }] : []),
    ], { x: x + 0.15, y: y + 0.06, w: w - 0.3, h: h - 0.12, valign: "middle", margin: 0, paraSpaceAfter: 2, isTextBox: true });
  };
  const freccia = (x, y, h, nome) => s.addShape(pres.shapes.DOWN_ARROW, { x, y, w: 0.32, h, fill: { color: HEX.ocra }, line: { color: HEX.ocra }, objectName: nome });
  // Utenti
  [["Comuni", "promotori del progetto"], ["Fondazione Operate", "operatori e amministratori"], ["Pubblico e stakeholders", "pagine pubbliche senza account"]].forEach(([t, d], i) =>
    box(0.6 + i * 2.72, 1.4, 2.56, 0.78, C.accent3, t, d, "Utenti " + t));
  freccia(4.25, 2.24, 0.34, "Freccia utenti-portale");
  // Portale e GitHub
  box(0.6, 2.64, 5.9, 0.86, C.background2, "Portale web · Vercel (HTTPS)", "React: pagine, controlli dei file, lettura del tracciato, calcolo dei crediti e PDF nel browser", "Vercel");
  box(6.75, 2.64, 1.97, 0.86, C.background2, "GitHub", "codice e storico; pubblicazione automatica", "GitHub");
  s.addShape(pres.shapes.LEFT_ARROW, { x: 6.5, y: 2.94, w: 0.26, h: 0.26, fill: { color: HEX.ocra }, line: { color: HEX.ocra }, objectName: "Freccia GitHub-Vercel" });
  freccia(4.25, 3.56, 0.34, "Freccia portale-Supabase");
  // Supabase
  card(s, 0.6, 3.96, 8.12, 2.12, C.text2, "Supabase");
  s.addText("Supabase · dati, regole e documenti", { x: 0.78, y: 4.02, w: 7.8, h: 0.36, fontSize: 14, bold: true, color: C.background1, margin: 0, isTextBox: true });
  [
    ["Database Postgres", "oltre 30 tabelle; regole di accesso per ruolo su ogni tabella; azioni sensibili solo con funzioni che chiedono la motivazione"],
    ["Accesso", "email e password; password temporanea inviata per email; recupero; verifica in due passaggi pronta"],
    ["Archivio documenti", "privato; versioni mai sovrascritte con impronta SHA-256"],
    ["Funzioni e lavori pianificati", "utenti, email, pagina pubblica; scadenze e avvisi ogni giorno"],
  ].forEach(([t, d], i) => box(0.75 + i * 1.98, 4.44, 1.88, 1.5, C.background1, t, d, "Supabase " + t));
  freccia(4.25, 6.12, 0.26, "Freccia Supabase-Resend");
  box(3.0, 6.4, 3.3, 0.5, C.background2, "Resend · email di notifica", null, "Resend");
  // Garanzie e prossimi passi
  card(s, 9.0, 1.4, 3.7, 3.05, C.background2, "Garanzie");
  s.addText("Garanzie", { x: 9.2, y: 1.5, w: 3.3, h: 0.38, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true });
  s.addText(["Chi vede e chi modifica lo decide il database, non lo schermo", "Audit di ogni operazione, non modificabile", "Nessuna chiave segreta nel browser", "Nessuna cancellazione: conservazione 12 anni", "Banca Dati Utenze solo con codici anonimi", "Backup, istruzioni di ripristino; amministratore principale protetto"].map((t, j, a) => ({ text: t, options: { bullet: true, breakLine: j < a.length - 1 } })),
    { x: 9.2, y: 1.92, w: 3.35, h: 2.45, fontSize: 12, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true });
  card(s, 9.0, 4.6, 3.7, 2.3, C.accent3, "Prossimi passi infrastruttura");
  s.addText("Prossimi passi", { x: 9.2, y: 4.7, w: 3.3, h: 0.38, fontSize: 15, bold: true, color: C.text2, margin: 0, isTextBox: true });
  s.addText(["Piani a pagamento Vercel e Supabase, repository privato", "Copie automatiche di database e file, ambiente di prova", "Dominio email operate.it", "Verifica in due passaggi, antivirus"].map((t, j, a) => ({ text: t, options: { bullet: true, breakLine: j < a.length - 1 } })),
    { x: 9.2, y: 5.12, w: 3.35, h: 1.7, fontSize: 12, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true });
  s.addNotes("Il portale non ha un server proprio: le pagine sono pubblicate da Vercel e girano nel browser; dati, utenti e documenti stanno su Supabase (database Postgres, autenticazione, archivio file, funzioni server, lavori pianificati); le email partono da Resend; il codice è su GitHub e ogni modifica pubblicata su main va online da sola. La sicurezza è nel database: ogni tabella ha regole di accesso per ruolo (Row Level Security) e le azioni sensibili passano da funzioni che controllano ruolo, stato della pratica e motivazione; l'audit lo scrive il database e non si può modificare; la chiave di servizio non arriva mai al browser. Oggi i servizi sono sui piani gratuiti, in un ambiente unico: il passaggio ai piani a pagamento (deciso) porta backup, repository privato e limiti più ampi; restano da attivare l'ambiente di prova, il dominio email verificato, la verifica in due passaggi per lo staff e l'antivirus sui file. Copie di sicurezza: il 19/10 è stato fatto un archivio di backup completo (codice con tutta la storia, manuali, documenti ufficiali, progetto Claude, artefatti) ed è stato scritto il documento Istruzioni di ripristino, che spiega come rimettere in funzione GitHub, Vercel, Supabase, Resend e il progetto Claude. Oggi il database non ha copie automatiche (piano gratuito): con il piano Pro arrivano le copie giornaliere, ma i file caricati vanno comunque copiati a parte.");

  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Architettura e ruoli" });
  s.addText("Chi fa cosa nel portale", { placeholder: "title" });
  const ruoli = [
    { t: "Fondazione Operate", sub: "promotore del programma", c: C.text2, r: [
      "Operatori: cruscotto, pratiche e fasi, verifiche documentali con accuratezza e accertamenti, integrazioni",
      "Moderazione del feedback pubblico, pagamenti e tariffe, registro e vendite dei crediti, reclami, anagrafiche",
      "Amministratori (anche più di uno; il principale è protetto), in più: utenti, impostazioni, calcolo ed emissione dei crediti, audit",
    ], dopo: "Collaudo e messa in esercizio" },
    { t: "Comune", sub: "promotore del progetto", c: C.text2, r: [
      "Un solo account, quello del rappresentante; fino a 2 delegati",
      "Carica i documenti nelle fasi aperte, risponde a integrazioni e osservazioni",
      "Vede scadenze, stato nel Programma, pagamenti, crediti; scarica il fascicolo; invia reclami",
    ], dopo: "Collaudo con i dati reali di un Comune" },
    { t: "Ente di validazione e verifica", sub: "ISO 14065 o 17029", c: C.accent2, r: [
      "Censito in Anagrafiche e assegnato alle pratiche",
      "Rapporti di validazione e di verifica e dichiarazioni: li carica la Fondazione e diventano pubblici",
      "Tempi della Guida (75 e 60 giorni) seguiti con le scadenze delle fasi",
    ], dopo: "Sviluppo proposto: accesso dell'ente per caricare direttamente i rapporti firmati" },
    { t: "Pubblico e registri", sub: "stakeholders, piattaforme di scambio", c: C.accent2, r: [
      "Pagina /programma: documenti ufficiali, progetti, crediti emessi",
      "Feedback pubblico con email confermata; reclami alla PEC",
      "Vendite e cancellazioni del registro registrate dalla Fondazione",
    ], dopo: "Da fare: SPID, CIE o CNS; collegamento diretto ai registri" },
  ];
  const lw = (12.1 - 0.75) / 4;
  ruoli.forEach((r, i) => {
    const x = 0.6 + i * (lw + 0.25), y = 1.4, h = 5.5;
    card(s, x, y, lw, h, C.background2, "Ruolo " + r.t);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: lw, h: 0.08, fill: { color: r.c }, line: { color: r.c }, objectName: "Barra " + r.t });
    s.addText([{ text: r.t, options: { bold: true, fontSize: 15, color: C.text2, breakLine: true } }, { text: r.sub, options: { fontSize: 11.5, color: C.accent6 } }],
      { x: x + 0.2, y: y + 0.2, w: lw - 0.4, h: 0.8, valign: "top", margin: 0, isTextBox: true });
    s.addText(r.r.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < r.r.length - 1 } })),
      { x: x + 0.2, y: y + 1.05, w: lw - 0.35, h: 3.2, fontSize: 12, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 6, isTextBox: true });
    card(s, x + 0.15, y + h - 1.1, lw - 0.3, 0.95, C.background1, "Prossimo passo " + r.t);
    s.addText([{ text: "Prossimo passo", options: { bold: true, fontSize: 10.5, color: C.accent2, breakLine: true } }, { text: r.dopo, options: { fontSize: 11, color: C.text1 } }],
      { x: x + 0.27, y: y + h - 1.05, w: lw - 0.54, h: 0.85, valign: "middle", margin: 0, isTextBox: true });
  });
  s.addNotes("Fondazione Operate è il soggetto promotore del programma: lo Studio Associato Wastelab, proprietario del Programma, le ha conferito in esclusiva la gestione commerciale e tecnologica (portale CWP). Nel portale ha due ruoli: Operatori (back-office quotidiano) e Amministratori (configurazione, calcolo ed emissione dei crediti, audit). Il Comune, promotore del progetto, ha un solo account (Guida 7.2). L'ente di validazione e verifica oggi non ha un account: è censito e assegnato alle pratiche e i suoi rapporti e dichiarazioni li carica la Fondazione, rendendoli pubblici come chiede la Guida; un accesso dedicato all'ente (quarto ruolo, solo le pratiche assegnate) è lo sviluppo naturale. Il pubblico usa la pagina /programma e il feedback pubblico; i registri restano piattaforme esterne: vendite e cancellazioni sono registrate dalla Fondazione dalla Comunicazione di vendita e dalla Dichiarazione di cancellazione tombale (Standard 6.2).");

  // ---------------------------------------------------------------- Novità del 19 ottobre
  pres.addSection({ title: "Novità" });
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Novità" });
  s.addText("Novità del 19 e 20 ottobre", { placeholder: "title" });
  s.addImage({ path: IMMAGINI + "dashboard_led.png", x: 0.6, y: 1.3, w: 7.6, h: 7.6 * 1000 / 2400, altText: "Dashboard con la barra a LED delle 7 fasi per ogni pratica (dati di prova)", objectName: "Schermata Dashboard" });
  s.addText("Dashboard con dati di prova", { x: 0.6, y: 4.5, w: 7.6, h: 0.25, fontSize: 10, italic: true, color: C.accent6, margin: 0, isTextBox: true });
  [
    ["Fasi completate", "luci accese (ambra)"],
    ["Fase in corso", "spenta, con contorno"],
    ["Chiusura", "la settima luce è verde"],
  ].forEach(([t, d], i) => {
    const x = 0.6 + i * 2.6;
    card(s, x, 4.85, 2.4, 0.85, i === 2 ? C.accent3 : C.background2, "Legenda " + t);
    s.addText([{ text: t, options: { bold: true, color: C.text2, breakLine: true } }, { text: d, options: { fontSize: 11.5, color: C.text1 } }],
      { x: x + 0.15, y: 4.85, w: 2.1, h: 0.85, fontSize: 13, valign: "middle", margin: 0, isTextBox: true });
  });
  card(s, 0.6, 5.9, 7.6, 0.95, C.accent4, "Ordinamento");
  s.addText([{ text: "Tutte le tabelle si ordinano per colonna ", options: { bold: true, color: C.text2 } }, { text: "(clic sull'intestazione: ▲ crescente, ▼ decrescente); negli elenchi a schede c'è «Ordina per»." }],
    { x: 0.8, y: 5.9, w: 7.2, h: 0.95, fontSize: 13, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
  card(s, 8.45, 1.3, 4.25, 5.55, C.background2, "Elenco novità");
  const novita = [
    ["Utenti", "più amministratori; luca.moretti@operate.it è il principale e ha la sezione «Audit trail user»: chi è online, accessi e operazioni di ogni utente (20/10)"],
    ["Credenziali per email", "al nuovo utente arrivano indirizzo, email e password temporanea (a tutti dopo la verifica del dominio)"],
    ["Assistente virtuale", "«✦ Assistente» con Claude per enti e Amministratori, dai manuali e dalle tariffe; attivo dal 19/10, errori in italiano dal 20/10"],
    ["Simulatore", "metodo «per utenza, solo utenze virtuose» come nell'Allegato A EsaCom; dal 20/10 PDF impaginato ed export Excel"],
    ["Documentazione", "gli 8 documenti ufficiali del Programma v1.2 e questa presentazione, per gli Amministratori"],
    ["Decisione", "qualificazione ACN non necessaria (parere legale da confermare)"],
  ];
  s.addText(novita.flatMap(([t, d], j) => [
    { text: t, options: { bold: true, color: C.text2, breakLine: true } },
    { text: d, options: { color: C.text1, fontSize: 12, breakLine: j < novita.length - 1 } },
  ]), { x: 8.65, y: 1.45, w: 3.9, h: 5.3, fontSize: 13.5, valign: "top", margin: 0, paraSpaceAfter: 5, isTextBox: true });
  s.addNotes("Novità pubblicate il 19 ottobre pomeriggio, su richiesta di Luca. Dashboard (prima «Cruscotto»): per ogni pratica una barra di 7 luci, una per fase, accese le fasi completate e spente quelle da fare, la settima verde; la fase in corso ha il contorno. Ordinamento: ogni tabella del portale si ordina per qualsiasi colonna e gli elenchi a schede hanno il menu «Ordina per». Utenti: un Amministratore può nominare altri Amministratori, tutti con accesso completo; l'Amministratore principale luca.moretti@operate.it è protetto dal database (non si declassa, non si disattiva, non si cancella, nemmeno dal pannello di Supabase); si possono eliminare solo gli utenti che non hanno mai operato (nessuna voce nell'audit e nessun dato a loro nome). Email: il nuovo utente riceve indirizzo del portale, email e password temporanea, con l'obbligo di sceglierne una personale al primo accesso; finché il dominio operate.it non è verificato su Resend le email arrivano solo al titolare dell'account. Simulatore: oltre al bilancio del Comune c'è il metodo per utenza con le sole utenze virtuose (formula 32 con buffer), lo stesso delle stime dell'Allegato A dei contratti EsaCom; il buffer si calcola dalle Tabelle 15-16. Decisione: il portale non va qualificato ACN come servizio cloud per la PA, perché serve a qualificare il modello e il Comune vi riversa dati senza acquistare un servizio; restano GDPR, dati in UE e sicurezza; da confermare con un parere legale. Il 20 ottobre: sezione «Audit trail user» per l'Amministratore principale, con tutti gli utenti online o no, il registro degli accessi (entrate, uscite, tentativi non riusciti, senza indirizzi IP) e le operazioni dell'audit trail per utente, compreso lo scaricamento dei documenti; utenti online per l'Amministratore principale (chi è collegato adesso, pagina aperta, da quanto, e chi è stato visto nelle ultime 24 ore; si conserva solo l'ultimo collegamento, gli utenti ne sono informati nel Manuale Utente); messaggi d'errore dell'assistente in italiano semplice, con la causa per gli Amministratori; simulatore con PDF impaginato in A4 orizzontale ed export Excel con i fogli Sintesi, Anni, Economia e Costi.");

  // ---------------------------------------------------------------- 4. Punti aperti
  pres.addSection({ title: "Punti aperti" });
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Punti aperti" });
  s.addText("Punti aperti: sviluppo e servizi da attivare", { placeholder: "title" });
  const colonne = [
    { i: "scudo", t: "Sicurezza e infrastruttura", r: [
      "Registro di sicurezza: accessi, tentativi falliti, cambi di permessi",
      "Verifica in due passaggi per lo staff (pronta, spenta) e scadenza delle sessioni",
      "Antivirus sui file; verifica OWASP, test di intrusione, librerie aggiornate",
      "Backup: archivio completo e istruzioni di ripristino fatti (19/10); da attivare copie automatiche di database e file, ambiente di prova, monitoraggio errori",
      "Piani a pagamento e repository privato (slide «Piani a pagamento»); dominio email verificato, che serve anche alle email con le credenziali",
    ] },
    { i: "server", t: "Avvio della piattaforma pubblica", r: [
      "Pagina /programma attiva con gli 8 documenti ufficiali v1.2 e la Metodologia approvata",
      "PEC del Programma per i reclami: operate@pec.it",
      "Da inserire: enti di validazione e verifica e registri riconosciuti, modulistica",
      "Accesso con SPID, CIE o CNS al feedback pubblico (adesione come fornitore di servizi)",
      "Collaudo completo delle nuove funzioni (crediti emessi, reclami, tariffe)",
    ] },
    { i: "puzzle", t: "Qualità dei dati e completamenti", r: [
      "Dati ufficiali per i controlli: popolazione e cluster SOSE di ogni Comune",
      "Conferma delle scelte interpretative del calcolo con l'ente",
      "Privacy: DPIA, registro dei trattamenti; accessibilità WCAG 2.1 AA",
      "Collaudo con i dati reali di un Comune",
      "Nuovi moduli: simulatore (online, due metodi), assistente virtuale (attivo dal 19/10; poi messaggi d'errore in italiano, Operatori e aiuto sulla pratica); utenti online per l'amministratore principale (in sviluppo)",
    ] },
  ];
  const cw = (12.1 - 0.6) / 3;
  colonne.forEach((c, i) => {
    const x = 0.6 + i * (cw + 0.3), y = 1.45, h = 5.3;
    card(s, x, y, cw, h, C.background2, "Colonna " + c.t);
    cerchio(s, x + 0.25, y + 0.25, 0.6, i === 1 ? C.accent2 : C.text2, ic[c.i], c.t);
    s.addText(c.t, { x: x + 1.0, y: y + 0.2, w: cw - 1.15, h: 0.7, fontSize: 17, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
    s.addText(c.r.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < c.r.length - 1 } })),
      { x: x + 0.3, y: y + 1.05, w: cw - 0.5, h: h - 1.2, fontSize: 13.5, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 7, isTextBox: true });
  });
  s.addNotes("La parte funzionale dei requisiti del 15/09 è chiusa e dal 18/10 sera il portale segue anche i documenti ufficiali del Programma. Restano tre gruppi. 1) Requisiti tecnici e di sicurezza (sezioni 13-15 dei requisiti); il 19/10 sono stati fatti l'archivio di backup completo e le Istruzioni di ripristino, mancano le copie automatiche di database e file. 2) Avvio della piattaforma pubblica (Guida 3.7): la pagina /programma è attiva e pubblica già gli otto documenti ufficiali v1.2 (Guida, Definizioni, Normativa, Standard, Metodologia, Politica di reclamo, Schema tariffario, Gestione qualità dei dati) e la Metodologia approvata; la PEC del Programma per i reclami è operate@pec.it; vanno aggiunti gli enti di validazione e verifica e i registri riconosciuti e la modulistica quando disponibile. L'accesso con SPID, CIE o CNS (Guida 3.9) richiede l'adesione della Fondazione come fornitore di servizi (AgID o aggregatore accreditato): fino ad allora resta l'email confermata. 3) Qualità dei dati e completamenti: i controlli del documento Gestione della qualità dei dati sono nel calcolo (Tabella 3 dello Standard ±30% con motivazione obbligatoria, completezza, unicità, letture a buon fine, tempestività) e servono popolazione e cluster SOSE ufficiali di ogni Comune; poi privacy, accessibilità, collaudo con dati reali. L'assistente AI resta un supporto al back-office, come previsto dai requisiti (sezione 17). Da fare subito (19/10 sera). Azioni di Luca: ripubblicare le funzioni crea-utente e reimposta-password (email delle credenziali), rieseguire la funzione utente_mai_attivo dello script 30, verificare il dominio email su Resend, decidere se intestare alla Fondazione la fatturazione dell'assistente. Sviluppo: utenti online per l'amministratore principale, messaggi d'errore dell'assistente in italiano (proposta), stampa PDF del simulatore, sicurezza e piani a pagamento, collaudo con dati reali.");

  // ---------------------------------------------------------------- 4a. Nuovi moduli: simulatore e assistente
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Punti aperti" });
  s.addText("Nuovi moduli: simulatore e assistente virtuale", { placeholder: "title" });
  // Simulatore
  card(s, 0.6, 1.35, 7.75, 5.5, C.background2, "Riquadro simulatore");
  cerchio(s, 0.85, 1.55, 0.6, C.accent2, ic.grafico, "Simulatore");
  s.addText("Simulatore di scenari", { x: 1.6, y: 1.5, w: 4.2, h: 0.4, fontSize: 18, bold: true, color: C.text2, margin: 0, isTextBox: true });
  s.addText("Quanti crediti potrebbe generare un Comune? Una stima anno per anno, prima di aderire.", { x: 1.6, y: 1.9, w: 4.3, h: 0.5, fontSize: 12, color: C.accent6, margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1.6, y: 2.42, w: 2.35, h: 0.3, rectRadius: 0.15, fill: { color: C.accent2 }, line: { color: C.accent2 }, objectName: "Badge online" });
  s.addText("PRIMA VERSIONE ONLINE", { x: 1.6, y: 2.42, w: 2.35, h: 0.3, fontSize: 10, bold: true, charSpacing: 1, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  // Menu a tendina della durata (illustrativo)
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.05, y: 1.55, w: 2.1, h: 0.42, rectRadius: 0.06, fill: { color: C.background1 }, line: { color: HEX.verde, width: 1.25 }, objectName: "Menu durata" });
  s.addText([{ text: "Durata: ", options: { color: C.accent6 } }, { text: "10 anni  ▾", options: { bold: true, color: C.text2 } }], { x: 6.15, y: 1.55, w: 1.95, h: 0.42, fontSize: 12, valign: "middle", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.RECTANGLE, { x: 6.05, y: 1.99, w: 2.1, h: 0.66, fill: { color: C.background1 }, line: { color: HEX.linea, width: 0.75 }, objectName: "Opzioni durata" });
  s.addText("7 anni  ·  10 anni  ·  21 anni", { x: 6.05, y: 1.99, w: 2.1, h: 0.66, fontSize: 11, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  const passi = [
    ["1", "Scenari per Comune", "Più scenari per ogni Comune («prudente», «obiettivo»…), durata 7, 10 o 21 anni"],
    ["2", "Scenario di riferimento (Standard 4.8.1)", "Anno con il 65% di differenziata o valori medi del cluster SOSE; situazione attuale come partenza"],
    ["3", "Obiettivi anno per anno", "Produzione totale e pro capite prevista, secco residuo pro capite obiettivo"],
    ["4", "% di differenziata", "Ricalcolata ogni anno: (totale − secco) / totale"],
    ["5", "Crediti e conti economici", "Bilancio del Comune o per utenza (come l'Allegato A EsaCom); ricavi a 32 € anno per anno; costi Caso 1 o 2; margine"],
  ];
  passi.forEach(([n, t, d], i) => {
    const y = 2.8 + i * 0.78;
    s.addShape(pres.shapes.OVAL, { x: 0.9, y: y + 0.08, w: 0.46, h: 0.46, fill: { color: i === 4 ? C.accent2 : C.text2 }, line: { color: i === 4 ? C.accent2 : C.text2 }, objectName: "Passo " + n });
    s.addText(n, { x: 0.9, y: y + 0.08, w: 0.46, h: 0.46, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText([{ text: t, options: { bold: true, color: C.text2, breakLine: true } }, { text: d, options: { fontSize: 11.5, color: C.text1 } }],
      { x: 1.55, y, w: 6.6, h: 0.66, fontSize: 13.5, valign: "middle", margin: 0, isTextBox: true });
  });
  s.addText("Stima ex ante a scopo di pianificazione: i crediti veri si calcolano ex post con la Banca Dati Utenze.", { x: 0.9, y: 6.72 - 0.12, w: 7.3, h: 0.25, fontSize: 10, italic: true, color: C.accent6, margin: 0, isTextBox: true });
  // Assistente virtuale
  card(s, 8.6, 1.35, 4.1, 5.5, C.accent3, "Riquadro assistente");
  cerchio(s, 8.85, 1.55, 0.6, C.text2, ic.robot, "Assistente");
  s.addText("Assistente virtuale Claude", { x: 9.6, y: 1.5, w: 3.0, h: 0.75, fontSize: 18, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.6, y: 2.22, w: 2.4, h: 0.28, rectRadius: 0.14, fill: { color: C.background1 }, line: { color: C.text2, width: 0.75 }, objectName: "Badge attivo" });
  s.addText("ATTIVO DAL 19/10", { x: 9.6, y: 2.22, w: 2.4, h: 0.28, fontSize: 9.5, bold: true, charSpacing: 1, color: C.text2, align: "center", valign: "middle", margin: 0, isTextBox: true });
  const asst = [
    ["Per enti e Amministratori", "pulsante «✦ Assistente»: come si fa un'operazione, fasi, costi; risponde dai manuali e dalle tariffe"],
    ["Garanzie", "non vede le pratiche e non decide; nessun testo salvato; limite di domande al giorno"],
    ["Come funziona", "Claude Haiku 5.5 tramite una funzione sul server; la chiave resta in Supabase; meno di un centesimo a domanda"],
    ["Prossimi passi", "estensione agli Operatori e aiuto sulla singola pratica, con regole sulla privacy"],
  ];
  s.addText(asst.flatMap(([t, d], j) => [
    { text: t, options: { bold: true, color: C.text2, breakLine: true } },
    { text: d, options: { color: C.text1, breakLine: j < asst.length - 1 } },
  ]), { x: 8.85, y: 2.65, w: 3.65, h: 4.05, fontSize: 12.5, valign: "top", margin: 0, paraSpaceAfter: 6, isTextBox: true });
  s.addNotes("Due nuovi moduli entrano nel progetto e in tutti i documenti (Registro, backlog punti 37 e 21). Simulatore di scenari, richiesto da Luca il 19/10: per ogni Comune si creano più scenari; la durata si sceglie da un menu a tendina tra 7, 10 e 21 anni (Standard 4.3.8: periodo di 10 anni oppure 7 rinnovabili fino a 21); si acquisiscono i dati dell'anno base (popolazione, produzione totale e pro capite, raccolta differenziata, ripartizione per frazione, parametri del calcolo); per ogni anno si inseriscono gli obiettivi di produzione totale e pro capite e di secco residuo pro capite; il simulatore ricalcola la percentuale di differenziata e stima anno per anno i crediti che il Comune potrebbe generare, con due metodi: il bilancio del Comune (tutte le utenze insieme, il più prudente) e il metodo per utenza con le sole utenze virtuose e il buffer del Capitolo 7, lo stesso delle stime dell'Allegato A dei contratti EsaCom. È una stima ex ante utile a presentare il Programma ai Comuni: il modello semplificato va confermato dalla Fondazione. Assistente virtuale (prima versione del 19/10, attiva dallo stesso giorno): pulsante «✦ Assistente» per Amministratori e utenti degli enti; risponde in italiano solo dalla base di conoscenza (Manuale Utente e tariffe per gli enti, in più Manuale Amministratore e note sul calcolo per gli Amministratori), non vede le pratiche, non salva i testi, limite di 40 domande al giorno per utente. Funziona con Claude Haiku 5.5 tramite la funzione del server «assistente»; la base di conoscenza resta nella cache dei prompt, quindi una domanda costa di solito meno di un centesimo di dollaro. Funziona con una chiave della Claude Console, legata a un solo spazio di lavoro, inserita da Luca nei segreti di Supabase: l'uso API è fatturato a parte rispetto ai piani claude.ai; Luca ha collegato i crediti API mensili del piano Max e acquistato 100 dollari di crediti. Prova dal vivo del 19/10: risposte corrette su creazione utenti e costi del Caso 1. Passi successivi: Operatori e aiuto sulla singola pratica.");

  // ---------------------------------------------------------------- 4a-bis. Il simulatore in pratica
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Punti aperti" });
  s.addText("Il simulatore in pratica", { placeholder: "title" });
  s.addText([
    { text: "Portale → menu Simulatore. ", options: { bold: true, color: C.text2 } },
    { text: "Esempio con dati di prova: Comune di 12.500 abitanti (cluster 4), oggi 430 kg/ab e 90 kg/ab di secco, obiettivo 2036: 380 e 50 kg/ab." },
  ], { x: 0.6, y: 1.2, w: 12.1, h: 0.4, fontSize: 13, color: C.accent6, margin: 0, isTextBox: true });
  s.addImage({ path: IMMAGINI + "simulatore_risultati.png", x: 0.6, y: 1.72, w: 12.1, h: 12.1 * 858 / 2400, altText: "Risultati del simulatore: crediti netti per anno e raccolta differenziata", objectName: "Schermata simulatore" });
  const passiSim = ["Durata 7 · 10 · 21 anni", "Riferimento Standard 4.8.1: anno al 65% o cluster", "Obiettivi annui e traiettoria automatica", "% differenziata ricalcolata", "Crediti per anno, confronto, CSV e stampa"];
  passiSim.forEach((t, i) => {
    const x = 0.6 + i * 2.46;
    card(s, x, 6.2, 2.3, 0.62, i === 4 ? C.accent4 : C.accent3, "Passo simulatore " + (i + 1));
    s.addText(t, { x: x + 0.1, y: 6.2, w: 2.1, h: 0.62, fontSize: 11.5, bold: true, color: C.text2, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  s.addNotes("Il simulatore è già nel portale (menu Simulatore, per Operatori e Amministratori) ed è conforme al modello CWP: scenario di riferimento dello Standard 4.8.1 (anno in cui il Comune ha raggiunto il 65% di differenziata oppure valori medi del cluster SOSE della Tabella 3 × popolazione ISPRA 2022), durata 7, 10 o 21 anni (Standard 4.3.8), stima ex ante a livello di Comune ammessa dalla Metodologia (Capitoli 6.1 e 6.2), fattori di emissione e formule della Metodologia v1.2, buffer. L'esempio usa dati di prova: un Comune di 12.500 abitanti del cluster 4 (riferimento 445 kg/ab, 78,7% di differenziata), oggi a 430 kg/ab con 90 kg/ab di secco, obiettivo al 2036 di 380 kg/ab e 50 kg/ab di secco. Il simulatore ricalcola ogni anno la differenziata (fino all'87%) e stima circa 11.500 tCO₂eq di crediti netti in 10 anni dopo un buffer del 20%. Da sapere: i crediti nascono dai rifiuti evitati rispetto al riferimento (qui 1 t in meno vale circa 2,7 tCO₂eq); spostare rifiuti dal secco alla differenziata a parità di totale non genera crediti. È una stima ex ante, non certificabile; il modello va confermato dalla Fondazione.");

  // ---------------------------------------------------------------- 4a-ter. Simulazione economica
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Punti aperti" });
  s.addText("Simulazione economica: ricavi e costi per il Comune", { placeholder: "title" });
  s.addImage({ path: IMMAGINI + "simulatore_economia.png", x: 0.6, y: 1.3, w: 5.5 * 2120 / 1708, h: 5.5, altText: "Simulatore, metodo per utenza: costi Caso 1 per 16.735 abitanti, ricavi, margine e margine netto per anno", objectName: "Schermata costi" });
  card(s, 8.15, 1.3, 4.55, 5.47, C.background2, "Riquadro economia");
  s.addText([
    { text: "Ricavi", options: { bold: true, color: C.text2, fontSize: 14, breakLine: true } },
    { text: "Valore del credito digitato anno per anno (proposto 32 €).", options: { breakLine: true } },
    { text: " ", options: { fontSize: 6, breakLine: true } },
    { text: "Costi per il Comune: Caso 1 o Caso 2?", options: { bold: true, color: C.text2, fontSize: 14, breakLine: true } },
    { text: "Caso 1 progetto volontario, Caso 2 progetto obbligatorio da bando di gara. Sei voci (Progetto, Rapporto, registrazioni) in € per abitante interpolati per popolazione, con minimo e massimo annuo (tabelle del 28/07/2026).", options: { breakLine: true } },
    { text: " ", options: { fontSize: 6, breakLine: true } },
    { text: "Bovisio-Masciago, 10 anni, 32 €/credito", options: { bold: true, color: C.text2, fontSize: 14, breakLine: true } },
    { text: "Per utenza (come Allegato A): ", options: { bold: true } },
    { text: "34.188 crediti, ricavi € 1.093.792", options: { breakLine: true } },
    { text: "Caso 1 costi € 162.330 → ", options: {} },
    { text: "+€ 931.463", options: { bold: true, color: C.text2, breakLine: true } },
    { text: "Caso 2 costi € 242.658 → ", options: {} },
    { text: "+€ 851.135", options: { bold: true, color: C.text2, breakLine: true } },
    { text: "Bilancio del Comune: ", options: { bold: true } },
    { text: "6.707 crediti, € 214.464; Caso 1 +€ 52.134, Caso 2 −€ 28.193", options: { breakLine: true } },
    { text: " ", options: { fontSize: 6, breakLine: true } },
    { text: "Il Caso 1 riproduce i costi dei contratti EsaCom, il metodo per utenza le loro stime (0,19-0,23 crediti per abitante all'anno).", options: { italic: true, color: C.accent6 } },
  ], { x: 8.35, y: 1.42, w: 4.15, h: 5.25, fontSize: 12, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 3, isTextBox: true });
  s.addNotes("Il simulatore stima anche la parte economica per il Comune o il gestore. Ricavi: crediti netti stimati per anno × valore del credito, digitato anno per anno (proposto 32 €). Costi: il simulatore chiede se usare il Caso 1 (progetto volontario) o il Caso 2 (progetto obbligatorio, per esempio da bando di gara di un Comune che ha inserito il CWP come metodo), con le tabelle «Costi per il Soggetto Promotore» di Fondazione Operate del 28/07/2026: sei voci (Progetto, Rapporto di Monitoraggio, registrazione del Progetto, dei crediti del Progetto, del Rapporto e dei crediti del Rapporto), costo per abitante per fascia di popolazione con interpolazione e arrotondamento per eccesso, minimo e massimo annuo, una tantum ammortizzati in 10 anni; validazione dell'ente esclusa. Esempio con i dati ISPRA 2021 di Bovisio-Masciago (16.735 abitanti), obiettivo 400 kg/ab e 50 kg/ab di secco al 2036, 32 € a credito. Con il metodo per utenza (solo utenze virtuose, secco e organico misurati, tariffa puntuale, variabilità tra utenze 30%, buffer 30%): 34.188 crediti netti in 10 anni (0,20 per abitante all'anno, nell'intervallo 0,19-0,23 dell'Allegato A EsaCom), ricavi 1.093.792 €; Caso 1 costi 162.330 € (9,70 € per abitante) e margine +931.463 €; Caso 2 costi 242.658 € e margine +851.135 €. Con il bilancio del Comune (il metodo più prudente): 6.707 crediti, ricavi 214.464 €, Caso 1 +52.134 € (rientro nel 2034), Caso 2 −28.193 €. La differenza viene soprattutto dal fatto che Bovisio ha già l'84% di differenziata: il secco delle utenze è molto sotto il riferimento al 65%. Il Caso 1 con 154.247 abitanti riproduce le cifre dei contratti tipo EsaCom. L'Allegato A indica 6,08 € per abitante di costo contro 5,36 delle tabelle: la differenza potrebbe essere l'ente di validazione e verifica. Stima indicativa, non un piano finanziario.");

  // ---------------------------------------------------------------- 4b. Piani a pagamento
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Punti aperti" });
  s.addText("Piani a pagamento: sicurezza e stabilità", { placeholder: "title" });
  const HP = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 } } });
  const piani = [
    ["GitHub\ncodice sorgente", "Organizzazione «Fondazione Operate», piano Team, repository privato", "Il codice diventa privato e di proprietà della Fondazione; modifiche a main solo con revisione e regole sul ramo; avvisi sulle librerie vulnerabili. Opzione: blocco delle chiavi caricate per errore (Secret Protection)", "4 $ per utente\n(+19 $ opzione)"],
    ["Vercel\npagine del portale", "Pro", "Il piano gratuito è solo per uso non commerciale; banda 1 TB, build più veloci, controllo della spesa; indirizzo portale.operate.it", "20 $ per utente"],
    ["Supabase\ndati, utenti, documenti", "Pro + calcolo Small", "Backup giornalieri (7 giorni) e progetto mai sospeso; 8 GB di database, 100 GB di documenti; più memoria (2 GB) per tempi di risposta stabili; supporto via email", "25 $ + 5 $"],
    ["Supabase\nopzioni consigliate", "Ripristino a un minuto preciso (PITR), ambiente di prova", "Recupero dei dati a qualsiasi momento degli ultimi 7 giorni; le modifiche al database si provano prima su una copia", "100 $ + ≈10 $"],
    ["Resend\nemail", "Pro, dominio operate.it verificato", "50.000 email al mese senza limite giornaliero (oggi 100 al giorno): avvisi e scadenze non si bloccano; mittente della Fondazione", "20 $"],
    ["Sentry\nmonitoraggio errori", "Developer (gratuito)", "Avviso immediato quando una pagina va in errore; piano Team (26 $) se servono più utenti", "0 $"],
  ];
  s.addTable([[HP("Servizio"), HP("Piano"), HP("Cosa porta: sicurezza e prestazioni"), HP("Costo al mese")], ...piani.map((r, i) => r.map((t, j) => ({ text: t, options: { bold: j === 0, color: j === 3 ? C.accent2 : C.text1, fill: { color: i % 2 ? C.background1 : C.background2 } } })))], {
    x: 0.6, y: 1.3, w: 12.1, colW: [2.05, 2.45, 5.75, 1.85], fontSize: 11.5, valign: "middle",
    border: { type: "solid", pt: 0.5, color: HEX.linea }, rowH: [0.38, 0.72, 0.62, 0.72, 0.62, 0.62, 0.55], margin: [0.04, 0.1, 0.04, 0.1],
  });
  const tot = [
    ["Indispensabili per l'avvio", "≈ 74 $ al mese", "GitHub Team, Vercel Pro, Supabase Pro con calcolo Small, Resend Pro"],
    ["Con le opzioni consigliate", "≈ 200 $ al mese", "più ripristino PITR, ambiente di prova e blocco delle chiavi su GitHub"],
  ];
  tot.forEach(([t, v, d], i) => {
    const x = 0.6 + i * 6.15;
    card(s, x, 5.95, 5.95, 0.85, i ? C.accent4 : C.accent3, "Totale " + t);
    s.addText([{ text: t + ": ", options: { bold: true, color: C.text2 } }, { text: v, options: { bold: true, color: C.accent2 } }, { text: "\n" + d, options: { fontSize: 11, color: C.text1 } }],
      { x: x + 0.2, y: 5.95, w: 5.6, h: 0.85, fontSize: 14, valign: "middle", margin: 0, isTextBox: true });
  });
  s.addText("Listini di ottobre 2026, in dollari, IVA esclusa. Gratis e da attivare subito: verifica in due passaggi sugli account GitHub, Vercel, Supabase e Resend.", { x: 0.6, y: 6.8, w: 11.4, h: 0.22, fontSize: 9.5, italic: true, color: C.accent6, margin: 0 });
  s.addNotes("Oggi tutti i servizi sono sui piani gratuiti, che non vanno bene per l'esercizio (attenzione: le copie giornaliere di Supabase Pro non comprendono i file caricati, che si copiano a parte come spiegato nelle Istruzioni di ripristino): Vercel Hobby è solo per uso non commerciale, i progetti Supabase gratuiti non hanno backup e si sospendono dopo una settimana di inattività, Resend gratuito invia al massimo 100 email al giorno, e il repository GitHub è pubblico. Indispensabili (circa 74 dollari al mese): GitHub Team (4 dollari per utente) con un'organizzazione intestata alla Fondazione, repository privato e regole sul ramo main (revisione obbligatoria); Vercel Pro (20 dollari per utente, banda 1 TB, uso commerciale, controllo della spesa); Supabase Pro (25 dollari, comprende 10 dollari di calcolo Micro: backup giornalieri conservati 7 giorni, progetto mai sospeso, 8 GB di database, 100 GB di file, 100.000 utenti attivi al mese) più il passaggio al calcolo Small (15 dollari, 2 GB di memoria, differenza 5 dollari); Resend Pro (20 dollari, 50.000 email al mese, nessun limite giornaliero). Consigliati (circa 130 dollari in più): Point-in-Time Recovery di Supabase (100 dollari al mese, ripristino al minuto degli ultimi 7 giorni), ambiente di prova con branching Supabase (0,01344 dollari l'ora, circa 10 dollari al mese se sempre attivo), GitHub Secret Protection (19 dollari per committer attivo). Sentry Developer è gratuito (1 utente, 5.000 errori al mese). Il piano Supabase Team (599 dollari al mese, certificazioni SOC 2 e ISO 27001, backup 14 giorni) oggi non serve. A costo zero: verifica in due passaggi sugli account dei fornitori, chiavi solo nelle variabili d'ambiente, dominio operate.it per portale ed email (SPF, DKIM, DMARC).");

  // ---------------------------------------------------------------- 5. Scelte pending
  pres.addSection({ title: "Scelte da prendere" });
  s = pres.addSlide({ masterName: "CONTENUTO", sectionTitle: "Scelte da prendere" });
  s.addText("Scelte ancora da prendere", { placeholder: "title" });
  const H = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 } } });
  const righe = [
    ["Accesso con SPID, CIE o CNS al feedback pubblico", "Previsto dalla Guida 3.9: serve l'adesione come fornitore di servizi", "Fondazione"],
    ["Rapporti prima della registrazione del Progetto: oggi ammessi", "Lo Standard 4.5 li prevede dopo «progetto registrato» (i crediti già lo richiedono)", "Fondazione"],
    ["Importi delle tariffe da applicare", "Lo Schema tariffario indica tariffe massime, IVA esclusa", "Fondazione"],
    ["Scelte interpretative del calcolo (FEdes, segno del riuso, buffer, Tabella 16)", "Determinano il valore dei crediti", "Fondazione con l'ente"],
    ["Procedura di fine conservazione e ambito dell'assistente virtuale", "12 anni (Guida 6.2.1); assistente fuori dal flusso decisionale", "Fondazione"],
    ["Simulatore: metodo per le proposte, variabilità tra utenze (ipotesi 30%), chi vede gli scenari", "Solo utenze virtuose con buffer (Metodologia 4.6 e Cap. 7), come l'Allegato A EsaCom", "Fondazione"],
    ["Qualificazione ACN del portale", "Valutata non necessaria: qualifica il modello, il Comune non acquista un servizio cloud", "Parere legale"],
    ["Servizi: dominio operate.it, piani a pagamento, verifica in due passaggi, antivirus, Comune per il collaudo", "Avvio in esercizio", "Fondazione e Luca Moretti"],
  ];
  s.addTable([[H("Scelta"), H("Cosa dicono i documenti CWP"), H("Chi decide")], ...righe.map((r, i) => r.map((t, j) => ({ text: t, options: { bold: j === 0, fill: { color: i % 2 ? C.background1 : C.background2 } } })))], {
    x: 0.6, y: 1.35, w: 12.1, colW: [5.3, 4.8, 2.0], fontSize: 13, color: C.text1, valign: "middle",
    border: { type: "solid", pt: 0.5, color: HEX.linea }, rowH: 0.56, margin: [0.04, 0.12, 0.04, 0.12],
  });
  s.addNotes("Il 18 ottobre sera sono state prese e realizzate le scelte di allineamento ai documenti ufficiali: Rapporto a 7 fasi con feedback di 20 giorni (Guida 6.3.1), conservazione 12 anni (Guida 6.2.1 e 6.5.1), un solo account per Organizzazione con fino a 2 delegati (Guida 7.2), periodo di 10 anni o 7 rinnovabili (Standard 4.3.8), stati e ID della Guida, ritiro e rientro, un solo progetto per territorio, tariffe e sospensione fino al saldo, piattaforma pubblica, crediti emessi con registro esterno, reclami, qualità dei dati. Il ruolo di soggetto promotore del programma è definito: Wastelab ha conferito in esclusiva a Fondazione Operate la gestione commerciale e tecnologica (portale CWP). Restano aperte quelle in tabella. Lo Standard 4.14 chiede al promotore del progetto di conservare i documenti almeno 2 anni dopo la fine del progetto, i registri 5 anni dopo la vendita (Standard 6.3). Scelte prese prima (Registro, capitolo Decisioni): A (una nuova versione non fa ripartire il termine), B (errata corrige: ripartenza decisa caso per caso), D (commentatori esterni con email confermata, in attesa di SPID), durate modificabili dall'Admin, pagamenti visibili al Comune, chiusura manuale della pratica, documenti richiesti non bloccanti, audit leggibile dallo staff. Le scelte interpretative del calcolo sono sette (docs/crediti-cwp.md). Il 19 ottobre: più amministratori con uno principale protetto; qualificazione ACN valutata non necessaria (da confermare con un parere legale).");

  await pres.writeFile({ fileName: OUT });
  if (applyTheme) await applyTheme(OUT, THEME);
  else console.warn("Avviso: apply_theme.js non trovato, tema colori di PowerPoint non applicato (i colori delle slide restano corretti).");
  console.log("scritto", OUT);
  // Copia in PDF con LibreOffice, se installato (per aprirla dal portale).
  try {
    execSync(`soffice --headless --convert-to pdf --outdir "${path.dirname(OUT)}" "${OUT}"`, { stdio: "ignore", timeout: 180000 });
    console.log("scritto", OUT.replace(/\.pptx$/, ".pdf"));
  } catch {
    console.warn("Avviso: PDF non creato (LibreOffice non disponibile): resta il solo PowerPoint.");
  }
})();
