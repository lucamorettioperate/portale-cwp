/* =========================================================================
   simulatoreExport.js — contenuto di stampa ed export Excel del simulatore
   Scopo (backlog 37, 20/10/2026): prepara in un'unica forma le tabelle di
     uno scenario del simulatore (sintesi, crediti anno per anno, parte
     economica, costi del Caso 1 o 2, avvisi) e scrive il file Excel
     (.xlsx). Le stesse tabelle le usa il PDF impaginato
     (src/lib/crediti/simulatorePdf.js), così stampa ed Excel dicono sempre
     le stesse cose. Dal 21/10/2026 il contenuto comprende tutti i dati
     inseriti nella pagina (foglio Excel «Dati inseriti») e i grafici
     (solo nel PDF; nell'Excel ci sono i numeri per rifarli).
   Il file .xlsx si scrive senza librerie in più: è un archivio ZIP (JSZip,
     già usata per leggere il tracciato dati) con pochi file XML secondo lo
     standard Office Open XML. Un foglio per sezione: «Sintesi», «Dati
     inseriti», «Anni», «Economia», «Costi». I numeri restano numeri (si
     possono sommare e ordinare in Excel), con il formato italiano dato da Excel stesso.
   Usato da: src/pages/Simulatore.jsx (pulsanti «Scarica PDF» ed «Esporta
     Excel»). Prove: test/simulatoreExport.test.mjs.
   Nessun dato letto o scritto nel database.
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti» (simulatore);
   backlog 37.
   ========================================================================= */
import JSZip from "jszip";
import {
  METODI_STIMA, RIFIUTI_MISURATI, UTENZE_MONITORATE, STIMA_PREDEFINITA, RD_SOGLIA, TIPOLOGIE,
  bufferMetodologia, costiPerCaso, listinoDi, NOTA_UNA_TANTUM, avvisoDurataCosti,
} from "./simulatore.js";
import { CLUSTER } from "./qualita.js";

// Campo vuoto (non indicato) e numero da testo con la virgola decimale.
const vuoto = (v) => v === null || v === undefined || String(v).trim() === "";
const numero = (v) => {
  if (vuoto(v)) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Nomi dei listini dei costi (come i pulsanti della pagina).
export const NOMI_LISTINO = {
  caso1: "Caso 1 – Progetto volontario",
  caso2: "Caso 2 – Progetto obbligatorio (da bando)",
  schema: "Schema tariffario v1.2 (tariffe massime)",
  nessuno: "Nessuna tariffa del Programma",
};

const AVVERTENZA =
  "Stima ex ante a scopo di pianificazione, non certificabile: i crediti veri si calcolano ex post con la Banca Dati Utenze " +
  "(Metodologia CWP v1.2). Importi IVA esclusa; i costi definitivi li conferma Fondazione Operate.";

/* Prepara le tabelle dello scenario. Parametri:
   - scenario: { nome, comune, durata, anno_inizio, note, dati } (dati =
     i valori inseriti nella pagina: impostazioni, scenario di riferimento,
     situazione attuale, obiettivi, parte economica);
   - risultato: esito di simula() (base, righe, totali, bufferPct,
     metodoStima, avvisi);
   - eco: esito di simulaEconomia() oppure null;
   - economia: impostazioni economiche dello scenario (listino, prezzi…);
   - popolazione: popolazione usata per la parte economica.
   Dal 21/10/2026 (richiesta di Luca: «nel report inserisci tutti i dati
   completi della simulazione con costi e grafici, in pratica cosa hai nella
   forma») il contenuto riprende TUTTE le sezioni della pagina:
   impostazioni e buffer del Capitolo 7, scenario di riferimento con i
   rifiuti per tipologia, situazione attuale, obiettivi anno per anno,
   risultati con il totale, parametri economici, costi e grafici.
   Restituisce { titolo, sottotitolo, avvertenza, scheda, sintesi,
   impostazioni, buffer, riferimento, attuale, obiettivi, anni,
   spiegazione, parametriEconomici, economia, costi, grafici, avvisi, note }.
   I valori numerici restano numeri (null = vuoto). */
export function contenutoSimulazione({ scenario, risultato, eco = null, economia = {}, popolazione = null }) {
  const dati = scenario.dati || {};
  const t = risultato.totali || {};
  const righeR = risultato.righe || [];
  const base = risultato.base || {};
  const popMedia = righeR.length ? righeR.reduce((s, r) => s + (r.popolazione || 0), 0) / righeR.length : 0;
  const perAbitante = t.mediaAnnuaNetti != null && popMedia ? t.mediaAnnuaNetti / popMedia : null;
  const metodo = (METODI_STIMA.find((m) => m.id === risultato.metodoStima) || METODI_STIMA[0]).nome;
  const perUtenza = risultato.metodoStima === "utenze";
  const listino = listinoDi(economia);
  const fine = scenario.anno_inizio + scenario.durata - 1;

  const scheda = [
    ["Comune", scenario.comune || "—"],
    ["Scenario", scenario.nome || "—"],
    ["Periodo", `${scenario.durata} anni, dal ${scenario.anno_inizio} al ${fine}`],
    ["Metodo di stima", metodo],
    ["Buffer applicato", `${risultato.bufferPct ?? "—"}% dei crediti lordi`],
    ["Costi del Programma", NOMI_LISTINO[listino] || "—"],
    ["Generato il", new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })],
  ];

  const sintesi = [
    ["Crediti netti nel periodo", t.netti ?? null, "tCO2eq"],
    ["Crediti lordi nel periodo", t.lordi ?? null, "tCO2eq"],
    ["Buffer trattenuto", t.buffer ?? null, "tCO2eq"],
    ["Media annua dei crediti netti", t.mediaAnnuaNetti ?? null, "tCO2eq/anno"],
    ["Crediti netti per abitante all'anno", perAbitante, "tCO2eq/ab/anno"],
    ["Rifiuti evitati nel periodo", t.riduzione ?? null, "t"],
    ["% di differenziata nell'ultimo anno", t.rdFinale ?? null, "%"],
    ["Produzione pro capite nell'ultimo anno", t.proCapiteFinale ?? null, "kg/ab"],
    ["Secco residuo pro capite nell'ultimo anno", t.seccoProCapiteFinale ?? null, "kg/ab"],
  ];
  if (eco?.totali) {
    const e = eco.totali;
    sintesi.push(
      ["Ricavi stimati nel periodo", e.ricavi, "€"],
      ["Costi nel periodo", e.costi, "€"],
      ["Costo medio annuo", e.costoAnnuoMedio ?? null, "€"],
      ["Margine nel periodo", e.margine, "€"],
      ["Valore medio del credito", e.prezzoMedio, "€/credito"],
      ["Costo per abitante nel periodo", e.costoProCapite, "€/ab"],
      ["Ricavo per abitante nel periodo", e.ricavoProCapite, "€/ab"],
      ["Primo anno con margine cumulato positivo", e.primoAnnoPositivo, ""],
      ["Primo anno di pareggio esatto (margine cumulato zero)", e.primoAnnoPareggio, ""],
    );
  }

  // ---- 1. Impostazioni (come la sezione 1 della pagina) ----
  const su = { ...STIMA_PREDEFINITA, ...(dati.stimaUtenze || {}) };
  const cap7 = bufferMetodologia({ ...su, soloVirtuose: perUtenza });
  const siNo = (b) => (b ? "sì" : "no");
  const pct = (v) => `${String(v).replace(".", ",")}%`;
  const impostazioni = [
    ["Nome dello scenario", scenario.nome || "—"],
    ["Comune", scenario.comune || "—"],
    ["Durata del periodo", `${scenario.durata} anni (dal ${scenario.anno_inizio} al ${fine})`],
    ["Primo anno", String(scenario.anno_inizio)],
    ["Metodo di stima dei crediti", metodo],
    ["Buffer previsto", risultato.bufferPct != null ? pct(risultato.bufferPct) : "—"],
    ["Rifiuti misurati per utenza (Tabella 16)", (RIFIUTI_MISURATI.find((r) => r.id === su.rifiuti) || RIFIUTI_MISURATI[1]).nome],
    ["Utenze monitorate (Tabella 15)", (UTENZE_MONITORATE.find((u) => u.id === su.utenze) || UTENZE_MONITORATE[0]).nome],
    ...(perUtenza ? [["Variabilità tra utenze", pct(su.variabilita ?? "—")]] : []),
    ["Tariffa puntuale attiva", siNo(su.tariffaPuntuale)],
    ["Misura anche ai centri di raccolta (-2%)", siNo(su.centriRaccolta)],
    ["Misura di ingombranti, verde o indumenti (-1%)", siNo(su.altreTipologie)],
  ];
  const buffer = {
    totale: cap7.totale,
    voci: cap7.voci.map((v) => [v.voce, v.pct]),
    uguale: Math.abs(numero(risultato.bufferPct) - cap7.totale) < 1e-9,
  };

  // ---- 2. Scenario di riferimento (Standard 4.8.1) ----
  const ab = dati.annoBase || {};
  const perCluster = ab.metodo === "cluster";
  const popRif = base.popolazione || numero(ab.popolazione);
  const riferimento = {
    scheda: [
      ["Metodo", perCluster ? "Valori medi del cluster (Tabella 3) × popolazione ISPRA 2022" : "Anno con il 65% di differenziata (Catasto ISPRA)"],
      ...(perCluster ? [] : [["Anno di riferimento", ab.anno ? String(ab.anno) : "—"]]),
      [perCluster ? "Popolazione (Catasto ISPRA 2022)" : "Popolazione nell'anno di riferimento", popRif ? popRif.toLocaleString("it-IT") : "—"],
      ["Cluster SOSE (Tabella 2 dello Standard)", ab.cluster ? `${ab.cluster} · ${CLUSTER[Number(ab.cluster) - 1] || ""}` : "—"],
    ],
    // Tutte le tipologie della pagina (vuoto = non indicato).
    rifiuti: {
      colonne: ["Tipologia", "Tonnellate", "kg/ab"],
      righe: TIPOLOGIE.map((tp) => {
        const q = (base.rifiuti || {})[tp.id];
        return [tp.nome, q ?? null, q != null && popRif ? (q * 1000) / popRif : null];
      }),
      totale: ["Totale", base.totale ?? null, base.proCapite ?? null],
    },
    riepilogo: [
      ["Produzione totale", base.totale ?? null, "t"],
      ["Produzione pro capite", base.proCapite ?? null, "kg/ab"],
      ["Secco residuo pro capite", base.seccoProCapite ?? null, "kg/ab"],
      ["Raccolta differenziata", base.rd ?? null, "%"],
      ["Fattore del secco (formule 16-17)", base.feSecco ?? null, "kgCO2eq/kg"],
    ],
  };

  // ---- Situazione attuale (facoltativa) ----
  const at = dati.attuale || {};
  const compilata = ["anno", "popolazione", "proCapite", "seccoProCapite"].some((k) => !vuoto(at[k]));
  const pcA = numero(at.proCapite);
  const scA = numero(at.seccoProCapite);
  const attuale = compilata
    ? [
        ["Anno", vuoto(at.anno) ? null : String(at.anno), ""],
        ["Popolazione", vuoto(at.popolazione) ? null : numero(at.popolazione), "ab"],
        ["Produzione pro capite", vuoto(at.proCapite) ? null : pcA, "kg/ab"],
        ["Secco residuo pro capite", vuoto(at.seccoProCapite) ? null : scA, "kg/ab"],
        ["Raccolta differenziata attuale", pcA > 0 && !vuoto(at.seccoProCapite) ? ((pcA - scA) / pcA) * 100 : null, "%"],
      ]
    : null;

  // ---- 3. Obiettivi anno per anno (valori usati dal calcolo) ----
  const obiettivi = {
    colonne: ["Anno", "Popolazione", "Produzione totale (t)", "Pro capite (kg/ab)", "Secco pro capite (kg/ab)", "Secco (t)", "% differenziata"],
    righe: righeR.map((r) => [r.anno, Math.round(r.popolazione || 0), r.totale, r.proCapite, r.seccoProCapite, r.secco, r.rd]),
  };

  // ---- 4. Risultati (stesse colonne della tabella della pagina) ----
  const somma = (f) => righeR.reduce((s, r) => s + (f(r) || 0), 0);
  const anni = {
    colonne: [
      "Anno", "Produzione totale (t)", "Riferimento (t)", "Rifiuti evitati (t)", "% differenziata", `Punti oltre il ${RD_SOGLIA}%`,
      ...(perUtenza ? ["Lordi bilancio del Comune (tCO2eq)"] : []),
      "Crediti lordi (tCO2eq)", "Buffer (tCO2eq)", "Crediti netti (tCO2eq)", "Netti cumulati (tCO2eq)",
    ],
    righe: righeR.map((r) => [
      r.anno, r.totale, r.riferimento, r.riduzione, r.rd, r.rdOltreSoglia, ...(perUtenza ? [r.lordiTerritorio ?? null] : []),
      r.lordi, r.buffer, r.debito > 0 ? -r.debito : r.netti, r.cumulatoNetti,
    ]),
    totali: righeR.length
      ? ["Totale", null, null, t.riduzione ?? null, null, null, ...(perUtenza ? [somma((r) => r.lordiTerritorio)] : []), t.lordi ?? null, t.buffer ?? null, t.netti ?? null, null]
      : null,
  };
  const unaTonnellata = base.feSecco != null ? -base.feSecco : null;
  const spiegazione =
    (perUtenza
      ? "Metodo per utenza: contano i rifiuti misurati che le utenze virtuose producono in meno rispetto al valore atteso dello scenario di riferimento; " +
        "il risultato è più alto del bilancio del Comune (colonna di confronto). "
      : "") +
    "I crediti nascono dai rifiuti evitati rispetto allo scenario di riferimento (Standard 4.8.1: anno con il 64-66% di differenziata " +
    "o valori medi del cluster, usati così come sono e riportati alla popolazione): ogni tonnellata pesa con il suo fattore di emissione e il secco con la media " +
    "dei fattori della differenziata (formule 16-17 della Metodologia CWP v1.2)" +
    (unaTonnellata != null ? `; con i dati di questo Comune 1 t in meno vale circa ${unaTonnellata.toLocaleString("it-IT", { maximumFractionDigits: 2 })} tCO2eq prima del buffer` : "") +
    ". Spostare rifiuti dal secco alla differenziata alza la percentuale di raccolta ma, a parità di produzione totale, non genera crediti.";

  // ---- 5. Parametri economici inseriti ----
  const valoreOVuoto = (v) => (vuoto(v) ? null : numero(v));
  const conEconomia = !vuoto(economia.prezzo) || !!listino || eco;
  const parametriEconomici = conEconomia
    ? [
        ["Valore ipotetico del credito (non stabilito dal Programma)", valoreOVuoto(economia.prezzo), "€/credito"],
        ["Variazione annua del valore", valoreOVuoto(economia.crescitaPrezzo) ?? 0, "%"],
        ...(!vuoto(economia.prezzoMin) ? [["Valore minimo del credito", numero(economia.prezzoMin), "€/credito"]] : []),
        ...(!vuoto(economia.prezzoMax) ? [["Valore massimo del credito", numero(economia.prezzoMax), "€/credito"]] : []),
        ["Costi del Programma", NOMI_LISTINO[listino] || "non scelti", "testo"],
        ["Popolazione per i costi", popolazione || null, "ab"],
        ["Ente di validazione, una tantum", valoreOVuoto(economia.costoValidazione), "€"],
        ["Ente di verifica, ogni anno", valoreOVuoto(economia.costoVerificaAnnua), "€"],
        ["Altri costi annui: registro, gestione", valoreOVuoto(economia.altriCostiAnnui), "€"],
      ]
    : null;

  const economiaTab = eco?.righe?.length
    ? {
        colonne: ["Anno", "Crediti", "Valore (€/credito)", "Ricavi (€)", "Partecipazione al Programma (€)", "Consulenza (€)", "Ente di validazione e verifica (€)", "Altri costi (€)", "Costi totali (€)", "Margine (€)", "Margine cumulato (€)"],
        righe: eco.righe.map((r) => [r.anno, r.crediti, r.prezzo, r.ricavi, r.partecipazione, r.consulenza, r.costiEnte, r.altriCosti, r.costi, r.margine, r.cumulato]),
        totali: ["Totale", eco.totali.crediti, eco.totali.prezzoMedio, eco.totali.ricavi, eco.totali.partecipazione, eco.totali.consulenza, eco.totali.costiEnte, eco.totali.altriCosti, eco.totali.costi, eco.totali.margine, null],
        // Rilievo N01: con il Caso 1 o 2 e una durata diversa da 10 anni i
        // totali sono una stima senza regola; lo si scrive sopra la tabella.
        stima: eco.durataFuoriListino ? avvisoDurataCosti(eco.righe.length) : null,
      }
    : null;

  const vociCosti = listino === "caso1" || listino === "caso2" ? costiPerCaso(listino, popolazione) : [];
  const costi = vociCosti.length
    ? {
        listino: NOMI_LISTINO[listino],
        righe: vociCosti.map((c) => [c.nome + (c.limite ? (c.limite === "minimo" ? " (costo minimo)" : " (costo massimo)") : ""), c.tipo === "consulenza" ? "Consulenza" : "Partecipazione", c.unitario, c.importo]),
        totale: (() => {
          const imp = vociCosti.reduce((s, c) => s + c.importo, 0);
          return ["Totale annuo", "", popolazione ? imp / popolazione : null, imp];
        })(),
        nota: NOTA_UNA_TANTUM,
      }
    : null;

  // ---- Grafici (gli stessi della pagina, più il margine cumulato) ----
  const etichette = righeR.map((r) => r.anno);
  const grafici = righeR.length
    ? [
        { titolo: "Crediti netti stimati per anno (tCO2eq)", tipo: "barre", etichette, valori: righeR.map((r) => (r.debito > 0 ? -r.debito : r.netti)), decimali: 0 },
        { titolo: "Raccolta differenziata (%)", tipo: "linea", etichette, valori: righeR.map((r) => r.rd), decimali: 1, unita: "%", soglia: RD_SOGLIA },
        ...(eco?.righe?.length
          ? [
              { titolo: "Margine netto per anno (€)", tipo: "barre", etichette: eco.righe.map((r) => r.anno), valori: eco.righe.map((r) => r.margine), decimali: 0 },
              { titolo: "Margine cumulato (€)", tipo: "linea", etichette: eco.righe.map((r) => r.anno), valori: eco.righe.map((r) => r.cumulato), decimali: 0, soglia: 0 },
            ]
          : []),
      ]
    : [];

  return {
    titolo: "Simulazione di scenario — Programma Carbon WastePrint®",
    sottotitolo: `${scenario.comune || ""} · ${scenario.nome || ""}`,
    avvertenza: AVVERTENZA,
    scheda,
    sintesi,
    impostazioni,
    buffer,
    riferimento,
    attuale,
    obiettivi,
    anni,
    spiegazione,
    parametriEconomici,
    economia: economiaTab,
    costi,
    grafici,
    avvisi: [...(risultato.avvisi || []), ...(eco?.avvisi || [])],
    note: scenario.note || "",
  };
}

// Nome di file sicuro per uno scenario: Simulazione_<Comune>_<scenario>.<est>
export function nomeFileSimulazione(scenario, estensione) {
  return `Simulazione_${scenario.comune || "Comune"}_${scenario.nome || "scenario"}.${estensione}`.replace(/[^A-Za-z0-9._àèéìòù-]+/g, "_");
}

// ---------------------------------------------------------------- Excel

// Testo sicuro dentro l'XML (& < > " e caratteri di controllo).
const xml = (s) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Lettera di colonna Excel (0 → A, 26 → AA).
function colonna(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Stili (xl/styles.xml): 0 normale, 1 intestazione (grassetto su verde
// chiaro), 2 numero con 2 decimali, 3 numero intero, 4 titolo grande,
// 5 testo in corsivo grigio (note), 6 grassetto, 7 riga del totale.
const STILI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF2F5D3A"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF2F5D3A"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF5A5E54"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE4EDE1"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF2F5D3A"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* Un foglio: righe = [[valori]] con valori testo, numero o null; stili =
   funzione (riga, colonna, valore) → numero di stile; larghezze = [n]. */
function foglio(righe, { stile = () => 0, larghezze = [], unisci = [] } = {}) {
  const cols = larghezze.length
    ? `<cols>${larghezze.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const dati = righe
    .map((riga, r) => {
      const celle = riga
        .map((v, c) => {
          if (v == null || v === "") return "";
          const rif = `${colonna(c)}${r + 1}`;
          const s = stile(r, c, v);
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${rif}" s="${s}"><v>${v}</v></c>`;
          return `<c r="${rif}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${celle}</row>`;
    })
    .join("");
  const merge = unisci.length ? `<mergeCells count="${unisci.length}">${unisci.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews>${cols}<sheetData>${dati}</sheetData>${merge}</worksheet>`;
}

// Stile per una tabella con intestazione alla riga «testa»: intestazione
// verde, numeri interi per anno e popolazione, 2 decimali per il resto.
const stileTabella = (testa, interi = [0], totale = -1) => (r, c, v) => {
  if (r < testa) return r === 0 ? 4 : 5;
  if (r === testa) return 1;
  if (r === totale) return typeof v === "number" ? 7 : 6;
  if (typeof v !== "number") return 0;
  return interi.includes(c) ? 3 : 2;
};

/* Scrive il file Excel dello scenario. Parametri: contenuto (da
   contenutoSimulazione). Restituisce una Promise con il Blob del file
   (in Node, con tipo "uint8array" per le prove). */
export async function creaXlsxSimulazione(contenuto, tipo = "blob") {
  const c = contenuto;
  const fogli = [];

  // Sintesi: titolo, avvertenza, scheda e indicatori.
  const sintesi = [
    [c.titolo], [c.avvertenza], [],
    ...c.scheda.map(([k, v]) => [k, v]), [],
    ["Indicatore", "Valore", "Unità"],
    ...c.sintesi.map(([k, v, u]) => [k, v, u]),
    ...(c.note ? [[], ["Note dello scenario"], [c.note]] : []),
    ...(c.avvisi.length ? [[], ["Avvisi"], ...c.avvisi.map((a) => [a])] : []),
  ];
  const testaSintesi = 3 + c.scheda.length + 1;
  fogli.push({
    nome: "Sintesi",
    xml: foglio(sintesi, {
      larghezze: [44, 34, 16],
      unisci: ["A2:C2"],
      stile: (r, col, v) => {
        if (r === 0) return 4;
        if (r === 1) return 5;
        if (r > 2 && r < 3 + c.scheda.length && col === 0) return 6;
        if (r === testaSintesi) return 1;
        if (typeof v === "number") return Number.isInteger(v) && v > 1900 && v < 2200 ? 3 : 2;
        if (v === "Note dello scenario" || v === "Avvisi") return 6;
        return 0;
      },
    }),
  });

  // Dati inseriti (dal 21/10/2026): tutto quello che c'è nella pagina,
  // sezione per sezione, così il file basta da solo a rifare la simulazione.
  {
    const r = [[c.titolo], [c.sottotitolo + " · dati inseriti nel simulatore"], []];
    const titoli = [];
    const teste = [];
    const sezione = (t) => { if (r.length > 3) r.push([]); titoli.push(r.length); r.push([t]); };
    const testa = (cols) => { teste.push(r.length); r.push(cols); };
    sezione("1. Impostazioni");
    c.impostazioni.forEach(([k, v]) => r.push([k, v]));
    r.push([`Buffer secondo il Capitolo 7: ${String(c.buffer.totale).replace(".", ",")}%`]);
    c.buffer.voci.forEach(([v, p]) => r.push([v, p, "%"]));
    sezione("2. Scenario di riferimento (Standard 4.8.1)");
    c.riferimento.scheda.forEach(([k, v]) => r.push([k, v]));
    testa(c.riferimento.rifiuti.colonne);
    c.riferimento.rifiuti.righe.forEach((x) => r.push(x));
    r.push(c.riferimento.rifiuti.totale);
    c.riferimento.riepilogo.forEach(([k, v, u]) => r.push([k, v, u]));
    sezione("Situazione attuale (facoltativa)");
    if (c.attuale) c.attuale.forEach(([k, v, u]) => r.push([k, v, u]));
    else r.push(["Non compilata: gli obiettivi partono dallo scenario di riferimento."]);
    sezione("3. Obiettivi anno per anno");
    testa(c.obiettivi.colonne);
    c.obiettivi.righe.forEach((x) => r.push(x));
    if (c.parametriEconomici) {
      sezione("5. Parametri della simulazione economica (IVA esclusa)");
      c.parametriEconomici.forEach(([k, v, u]) => r.push([k, v, u === "testo" ? "" : u]));
    }
    const titoliSet = new Set(titoli);
    const testeSet = new Set(teste);
    fogli.push({
      nome: "Dati inseriti",
      xml: foglio(r, {
        larghezze: [48, 22, 14, 18, 18, 14, 16],
        stile: (riga, col, v) => {
          if (riga === 0) return 4;
          if (riga === 1) return 5;
          if (titoliSet.has(riga) || testeSet.has(riga)) return titoliSet.has(riga) ? 6 : 1;
          if (typeof v !== "number") return 0;
          // Anni senza separatore delle migliaia; interi e decimali.
          if (col === 0 && Number.isInteger(v) && v >= 1900 && v < 2200) return 0;
          return Number.isInteger(v) ? 3 : 2;
        },
      }),
    });
  }

  // Anni: crediti anno per anno (risultati, con la riga del totale).
  {
    const righe = [[c.titolo], [c.sottotitolo], c.anni.colonne, ...c.anni.righe, ...(c.anni.totali ? [c.anni.totali] : [])];
    fogli.push({
      nome: "Anni",
      xml: foglio(righe, {
        larghezze: c.anni.colonne.map((h, i) => (i === 0 ? 8 : 15)),
        stile: stileTabella(2, [0], c.anni.totali ? righe.length - 1 : -1),
      }),
    });
  }

  // Economia e costi, se ci sono.
  if (c.economia) {
    const righe = [[c.titolo], [c.sottotitolo + " · importi IVA esclusa"], c.economia.colonne, ...c.economia.righe, c.economia.totali];
    const totaleEco = righe.length - 1;
    if (c.economia.stima) righe.push([], ["ATTENZIONE: " + c.economia.stima]);
    fogli.push({ nome: "Economia", xml: foglio(righe, { larghezze: c.economia.colonne.map((h, i) => (i === 0 ? 8 : 16)), stile: stileTabella(2, [0, 1], totaleEco) }) });
  }
  if (c.costi) {
    const righe = [[c.titolo], [`${c.costi.listino} · costi annui per il Comune o il gestore, IVA esclusa`], ["Voce", "Tipo", "€/abitante/anno", "€/anno"], ...c.costi.righe, c.costi.totale];
    const totaleCosti = righe.length - 1;
    if (c.costi.nota) righe.push([], [c.costi.nota]);
    fogli.push({ nome: "Costi", xml: foglio(righe, { larghezze: [50, 16, 16, 14], stile: stileTabella(2, [], totaleCosti) }) });
  }

  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${fogli.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${fogli.map((f, i) => `<sheet name="${f.nome}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${fogli.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${fogli.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", STILI);
  fogli.forEach((f, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, f.xml));
  return await zip.generateAsync({ type: tipo, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE" });
}
