/* =========================================================================
   Genera il fascicolo informativo della landing page delle campagne
   (public/marketing/Fascicolo_Carbon_WastePrint.pdf), richiesta di Luca
   Moretti del 23/10/2026: cos'è il Programma Carbon WastePrint®, come
   funziona per il Comune, il portale (con immagini) ed esempi di ritorni
   economici.
   Gli esempi si calcolano con microSimulazione (src/lib/marketing.js),
   cioè lo stesso motore della landing page e del simulatore: rigenerare il
   fascicolo quando cambiano prezzo di riferimento, listini o regole.
   Uso (dalla cartella del portale):
     node strumenti/genera_fascicolo_marketing.mjs
   Serve Python con WeasyPrint (python3 -m weasyprint).
   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import { writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { microSimulazione } from "../src/lib/marketing.js";

const RADICE = resolve(new URL("..", import.meta.url).pathname);
const IMG = (n) => "file://" + join(RADICE, n);
const euro = (v) => "€ " + Math.round(v).toLocaleString("it-IT");
const num = (v) => Math.round(v).toLocaleString("it-IT");

// Comuni tipo: produzione media italiana di circa 490 kg per abitante
// all'anno, secco residuo circa 150 kg (ordine di grandezza ISPRA).
const TIPI = [
  { nome: "Comune piccolo", abitanti: 5000, totale: 2450, secco: 750 },
  { nome: "Comune medio", abitanti: 20000, totale: 9800, secco: 3000 },
  { nome: "Città", abitanti: 60000, totale: 29400, secco: 9000 },
];
const DURATE = [7, 10, 21];
const ANNO = new Date().getFullYear() + 1;

const righe = TIPI.map((t) => ({
  ...t,
  durate: DURATE.map((anni) => ({
    anni,
    c1: microSimulazione({ ...t, anni, caso: "caso1", annoInizio: ANNO }).totali,
    c2: microSimulazione({ ...t, anni, caso: "caso2", annoInizio: ANNO }).totali,
  })),
}));
const esempio = microSimulazione({ ...TIPI[1], anni: 10, caso: "caso1", annoInizio: ANNO });
const ipotesi = esempio.ipotesi.map((i) => i.replace(/entro il \d{4}/, "entro l'ultimo anno"));

// Grafico SVG dell'esempio (ricavi e costi per anno, Comune medio, 10 anni).
function grafico(r) {
  const W = 640, H = 170, sx = 50, sy = 10, gy = 26, area = W - sx - 10, alt = H - sy - gy;
  const max = Math.max(...r.anni.map((a) => a.ricavi));
  const passo = area / r.anni.length, lb = passo * 0.32;
  const y = (v) => sy + alt - (v / max) * alt;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%">`;
  for (const q of [0, 0.5, 1]) s += `<line x1="${sx}" x2="${W - 10}" y1="${y(q * max)}" y2="${y(q * max)}" stroke="#e2ddd2"/><text x="${sx - 6}" y="${y(q * max) + 4}" text-anchor="end" font-size="10" fill="#5b5f5a">${Math.round(q * max / 1000)}k</text>`;
  r.anni.forEach((a, i) => {
    const cx = sx + passo * (i + 0.5);
    s += `<rect x="${cx - lb - 1}" y="${y(a.ricavi)}" width="${lb}" height="${sy + alt - y(a.ricavi)}" fill="#2f5d3a" rx="2"/>`;
    s += `<rect x="${cx + 1}" y="${y(a.costi)}" width="${lb}" height="${sy + alt - y(a.costi)}" fill="#c98a1a" rx="2"/>`;
    s += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#5b5f5a">${a.anno}</text>`;
  });
  return s + "</svg>";
}

const tabella = righe.map((t) => `
  <tr class="gruppo"><td colspan="5"><b>${t.nome}</b> · ${num(t.abitanti)} abitanti · ${num(t.totale)} t di rifiuti, ${num(t.secco)} t di secco residuo all'anno</td></tr>
  ${t.durate.map((d) => `<tr><td>${d.anni} anni</td><td>${num(d.c1.crediti)}</td><td>${euro(d.c1.ricavi)}</td><td><b>${euro(d.c1.margine)}</b><br><small>${euro(d.c1.costi)} di costi</small></td><td><b>${euro(d.c2.margine)}</b><br><small>${euro(d.c2.costi)} di costi</small></td></tr>`).join("")}`).join("");

const FASI = ["Adesione", "Prima verifica documentale", "Feedback pubblico (30 giorni)", "Risposta ai commenti e pubblicazione", "Validazione e verifica dell'ente terzo", "Seconda verifica documentale", "Chiusura: progetto registrato"];

const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
@font-face { font-family: Lib; src: url("${IMG("public/caratteri/LiberationSans-Regular.ttf")}"); }
@font-face { font-family: Lib; font-weight: bold; src: url("${IMG("public/caratteri/LiberationSans-Bold.ttf")}"); }
@page { size: A4; margin: 16mm 16mm 18mm; @bottom-center { content: "Programma Carbon WastePrint® · Fondazione Operate · pagina " counter(page); font: 8pt Lib; color: #7a7d78; } }
@page copertina { margin: 0; @bottom-center { content: none; } }
body { font-family: Lib, sans-serif; font-size: 10.5pt; color: #1d211c; line-height: 1.45; }
h1 { font-size: 30pt; line-height: 1.1; margin: 0 0 6mm; }
h2 { font-size: 17pt; color: #2f5d3a; margin: 0 0 4mm; }
h3 { font-size: 12pt; margin: 5mm 0 2mm; }
.pagina { page-break-before: always; }
.copertina { page: copertina; height: 297mm; background: linear-gradient(150deg, #1f4a2b, #2f5d3a 55%, #4f7d4a); color: #fff; padding: 22mm 20mm; box-sizing: border-box; position: relative; }
.copertina .loghi { background: #fff; border-radius: 4mm; padding: 4mm 6mm; display: inline-block; }
.copertina .loghi img { height: 15mm; vertical-align: middle; margin-right: 6mm; }
.copertina .anni { margin-top: 14mm; }
.copertina .anni div { display: inline-block; width: 46mm; margin-right: 4mm; background: rgba(255,255,255,.95); color: #2f5d3a; border-radius: 4mm; text-align: center; padding: 5mm 0; }
.copertina .anni b { display: block; font-size: 34pt; }
.copertina .anni span { color: #1d211c; font-size: 10pt; }
.copertina .piede { position: absolute; bottom: 20mm; left: 20mm; right: 20mm; font-size: 10pt; color: #dfe9db; }
.flusso { display: flex; gap: 3mm; margin: 4mm 0; }
.flusso div { flex: 1; background: #f4f1ea; border-radius: 3mm; padding: 3mm; font-size: 9.5pt; }
.flusso b { display: block; color: #2f5d3a; font-size: 10.5pt; margin-bottom: 1mm; }
.vantaggi { display: flex; flex-wrap: wrap; gap: 3mm; }
.vantaggi div { width: 84mm; border: 0.3mm solid #e2ddd2; border-radius: 3mm; padding: 3mm; font-size: 9.5pt; box-sizing: border-box; }
.vantaggi b { color: #2f5d3a; }
ol.fasi { padding-left: 5mm; } ol.fasi li { margin-bottom: 1.2mm; }
.casi { display: flex; gap: 4mm; } .casi div { flex: 1; background: #f4f1ea; border-radius: 3mm; padding: 3mm 4mm; font-size: 9.5pt; }
img.schermata { width: 100%; border: 0.3mm solid #e2ddd2; border-radius: 2mm; margin: 2mm 0 1mm; }
.didascalia { font-size: 8.5pt; color: #5b5f5a; margin-bottom: 4mm; }
table { width: 100%; border-collapse: collapse; font-size: 8.6pt; }
th { text-align: right; font-size: 8.5pt; color: #5b5f5a; padding: 1.5mm; border-bottom: 0.4mm solid #2f5d3a; }
th:first-child, td:first-child { text-align: left; }
td { text-align: right; padding: 1mm 1.5mm; border-bottom: 0.2mm solid #e2ddd2; vertical-align: top; }
td small { color: #5b5f5a; }
tr.gruppo td { text-align: left; background: #f4f1ea; padding-top: 2.5mm; }
.nota { font-size: 8.5pt; color: #5b5f5a; }
.riquadro { background: #2f5d3a; color: #fff; border-radius: 4mm; padding: 6mm; margin-top: 6mm; }
.riquadro a { color: #fff; }
.legenda span { display: inline-block; width: 3mm; height: 3mm; margin: 0 1mm 0 4mm; vertical-align: middle; }
</style></head><body>

<section class="copertina">
  <div class="loghi"><img src="${IMG("public/loghi/carbonwasteprint.png")}"><img src="${IMG("public/loghi/fondazione-operate.png")}" style="height:11mm"></div>
  <div style="margin-top:40mm; font-size:12pt; color:#dfe9db">Fascicolo informativo per i Comuni e i gestori</div>
  <h1 style="margin-top:4mm">I rifiuti evitati diventano risorse per il tuo Comune</h1>
  <div style="font-size:13pt; max-width:150mm; color:#e4ede1">Il Programma Carbon WastePrint® trasforma la riduzione dei rifiuti del territorio in crediti di carbonio certificati e in ricavi, ogni anno, per tutta la durata del progetto.</div>
  <div class="anni"><div><b>7</b><span>anni, rinnovabili</span></div><div><b>10</b><span>anni</span></div><div><b>21</b><span>anni di risorse</span></div></div>
  <div class="piede">Fondazione Operate · Programma Carbon WastePrint® · info@carbonwasteprint.com · portale-cwp.vercel.app</div>
</section>

<section class="pagina">
  <h2>Che cos'è il Programma Carbon WastePrint®</h2>
  <p>Il Programma, promosso dalla Fondazione Operate, misura le emissioni di gas serra evitate quando un territorio riduce i rifiuti prodotti e aumenta la raccolta differenziata. Le riduzioni, calcolate con la Metodologia CWP secondo la norma UNI EN ISO 14064-2 e controllate da un ente di validazione e verifica indipendente, diventano <b>crediti di carbonio</b>: ogni credito vale una tonnellata di CO₂ equivalente evitata.</p>
  <p>I crediti si vendono sul mercato volontario a imprese e organizzazioni che vogliono compensare le proprie emissioni. Il ricavato torna al territorio: risorse da reinvestire nel servizio di igiene urbana, nella tariffa e nei progetti ambientali.</p>
  <h3>Come funziona, in quattro passi</h3>
  <div class="flusso">
    <div><b>1. Il Comune aderisce</b>Con il gestore del servizio sceglie la durata (7, 10 o 21 anni) e conferisce i dati.</div>
    <div><b>2. Si misura</b>Ogni anno i dati delle utenze e dei conferimenti entrano nel portale e il calcolo si fa sui valori reali.</div>
    <div><b>3. Si certifica</b>L'ente terzo verifica il rapporto di monitoraggio; i crediti sono emessi con un codice univoco.</div>
    <div><b>4. Si vende</b>I crediti emessi si vendono; i ricavi finanziano il Comune anno dopo anno.</div>
  </div>
  <h3>I vantaggi per il Comune</h3>
  <div class="vantaggi">
    <div><b>Nuove entrate ogni anno</b><br>Risorse fuori dal bilancio ordinario, per tutta la durata del progetto.</div>
    <div><b>Tariffa più equa</b><br>Premia cittadini e imprese che producono meno rifiuti e differenziano meglio.</div>
    <div><b>Dati certi e trasparenti</b><br>Calcoli documentati, verificati da un ente terzo e pubblicati sulla piattaforma del Programma.</div>
    <div><b>Obiettivi ambientali</b><br>Misura concreta della riduzione dei rifiuti e delle emissioni, utile per i piani e la rendicontazione.</div>
    <div><b>Nessun lavoro in più</b><br>La Fondazione segue ogni fase; il Comune carica i dati e segue tutto dal portale.</div>
    <div><b>Partecipazione dei cittadini</b><br>Un obiettivo comune e misurabile: ogni chilo di rifiuti evitato vale.</div>
  </div>
</section>

<section class="pagina">
  <h2>Il percorso del progetto</h2>
  <p>Ogni progetto segue le fasi previste dalla Guida al Programma. Il portale mostra al Comune in quale fase si trova, le scadenze, i documenti e le richieste della Fondazione.</p>
  <ol class="fasi">${FASI.map((f) => `<li>${f}</li>`).join("")}</ol>
  <p>Dopo la registrazione, ogni anno si presenta il <b>rapporto di monitoraggio</b> con i dati misurati: dopo la verifica dell'ente terzo i crediti sono emessi e si possono vendere.</p>
  <h3>Due modi di partecipare</h3>
  <div class="casi">
    <div><b>Caso 1 – Progetto volontario</b><br>Il Comune (o il gestore) sceglie di aderire al Programma. Si applica il listino del Caso 1.</div>
    <div><b>Caso 2 – Da bando di gara</b><br>L'adesione è prevista dagli obblighi di un bando di gara del servizio. Si applica il listino del Caso 2.</div>
  </div>
  <h3>La durata</h3>
  <p>Il periodo del progetto può essere di <b>7 anni</b> (rinnovabile), <b>10 anni</b> o <b>21 anni</b>. Più è lungo, più a lungo il territorio riceve le risorse della vendita dei crediti.</p>
</section>

<section class="pagina">
  <h2>Il portale del Programma</h2>
  <p>Comuni e gestori usano il portale per caricare i dati, seguire le pratiche, vedere i calcoli dei crediti e il loro valore. Alcuni esempi:</p>
  <img class="schermata" src="${IMG("strumenti/presentazione/immagini/dashboard_valore_crediti.png")}">
  <div class="didascalia">Dashboard: valore dei crediti in simulazione, in fase esecutiva e valore dei progetti.</div>
  <img class="schermata" src="${IMG("strumenti/presentazione/immagini/simulatore_risultati.png")}" style="width:49%; display:inline-block">
  <img class="schermata" src="${IMG("strumenti/presentazione/immagini/simulatore_economia.png")}" style="width:49%; display:inline-block; float:right">
  <div class="didascalia" style="clear:both">Simulatore: crediti stimati anno per anno e piano economico con costi, ricavi e margine.</div>
</section>

<section class="pagina">
  <h2>Esempi di ritorni economici</h2>
  <p>Stime per tre Comuni tipo, con il motore del simulatore del portale. Il margine è la differenza tra i ricavi della vendita dei crediti e i costi del Programma nell'intero periodo.</p>
  <table>
    <thead><tr><th>Durata</th><th>Crediti</th><th>Ricavi</th><th>Margine Caso 1</th><th>Margine Caso 2</th></tr></thead>
    <tbody>${tabella}</tbody>
  </table>
  <h3>Esempio: Comune medio, 10 anni, Caso 1</h3>
  ${grafico(esempio)}
  <div class="legenda nota"><span style="background:#2f5d3a"></span>Ricavi <span style="background:#c98a1a"></span>Costi · margine nel periodo ${euro(esempio.totali.margine)}, ${euro(esempio.totali.perAbitante)} per abitante</div>
  <p class="nota"><b>Ipotesi.</b> ${ipotesi.join(" ")}</p>
</section>

<section class="pagina">
  <h2>Come aderire</h2>
  <p>Simula il tuo Comune in un minuto e chiedi la registrazione: la Fondazione ti ricontatta per verificare i dati e preparare l'adesione.</p>
  <ol>
    <li>Apri la pagina di simulazione (il collegamento «Approfondisci» dell'email della Fondazione, oppure <b>portale-cwp.vercel.app/scopri</b>).</li>
    <li>Inserisci abitanti, rifiuti totali e secco residuo dell'ultimo anno, la durata e il tipo di progetto.</li>
    <li>Guarda costi, ricavi e margine anno per anno, e invia la richiesta di registrazione.</li>
    <li>Ricevi le credenziali del portale e inizia il percorso con la Fondazione.</li>
  </ol>
  <div class="riquadro">
    <b style="font-size:14pt">Fondazione Operate · Programma Carbon WastePrint®</b><br>
    Email: info@carbonwasteprint.com<br>
    Simulazione e richiesta di registrazione: portale-cwp.vercel.app/scopri<br>
    Piattaforma pubblica del Programma: portale-cwp.vercel.app/programma
  </div>
  <img src="${IMG("strumenti/presentazione/immagini/qr_portale.png")}" style="width:34mm; margin-top:6mm">
  <p class="nota" style="margin-top:8mm">Le cifre di questo fascicolo sono stime indicative basate su ipotesi dichiarate e non costituiscono un'offerta: i crediti effettivi si calcolano ogni anno sui dati misurati e dipendono dalla verifica dell'ente terzo e dal prezzo di vendita. Valori IVA esclusa.</p>
</section>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), "fascicolo-"));
const file = join(dir, "fascicolo.html");
writeFileSync(file, html);
const pdf = join(RADICE, "public/marketing/Fascicolo_Carbon_WastePrint.pdf");
execFileSync("python3", ["-m", "weasyprint", file, pdf], { stdio: "inherit" });
console.log("Fascicolo scritto in", pdf);
