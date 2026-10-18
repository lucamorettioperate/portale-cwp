/* =========================================================================
   fascicoloPdf.js — riepilogo PDF del fascicolo di una pratica
   (requisiti §11: «ZIP + PDF/CSV riepilogativo»).

   Scopo: un documento leggibile da stampare o archiviare insieme ai file
   del fascicolo: dati della pratica e dell'Ente di Validazione, fasi,
   elenco dei documenti (con l'impronta SHA-256), integrazioni,
   consultazioni pubbliche, pagamenti e storico delle operazioni (questi
   ultimi due solo nell'export del back-office). Non contiene dati
   personali degli autori delle osservazioni.

   Usato da: src/lib/fascicolo.js, con import dinamico (jsPDF si scarica
   solo quando serve).
   Dati/servizi coinvolti: nessuna chiamata; riceve i dati già letti.
   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)»; capitolo 7
   «Funzionalità per area» (Export fascicolo).
   ========================================================================= */
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

const VERDE = [47, 93, 58];
const INK = [27, 33, 24];
const LINEA = [217, 212, 197];

const dataIt = (v) => (v ? new Date(String(v).length === 10 ? v + "T00:00:00" : v).toLocaleDateString("it-IT") : "—");
const dataOraIt = (v) => (v ? new Date(v).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const euro = (v) => (v == null ? "—" : Number(v).toLocaleString("it-IT", { style: "currency", currency: "EUR" }));
const STATI = { attiva: "Attiva", sospesa: "Sospesa", annullata: "Annullata", chiusa: "Chiusa", non_iniziata: "Non iniziata", in_corso: "In corso", in_attesa_integrazione: "In attesa di integrazione", completata: "Completata", ricevuto: "Ricevuto", pubblicato: "Pubblicato", non_pubblicato: "Non pubblicato", risposto: "Risposto" };
const stato = (s) => STATI[s] || s || "—";

/* Genera il riepilogo e restituisce un Blob PDF.
   Parametri (oggetto): pratica (con organizzazione, ente, fasi), fasi,
   nomeFase { id: "N - nome" }, documenti, integrazioni, consultazioni
   [{ ...consultazione, commenti, errata }], pagamenti, audit, nomi
   { utente_id: nome }, staff (bool), esportatoIl (testo). */
export function generaRiepilogoPdf({ pratica, fasi, nomeFase, documenti, integrazioni, consultazioni, pagamenti, audit, nomi, staff, esportatoIl }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  const base = {
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.8, cellPadding: 1.5, textColor: INK, lineColor: LINEA, lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: "bold" },
    margin: { left: M, right: M, top: 18, bottom: 16 },
  };
  let y = 18;

  // Titolo di sezione; va a pagina nuova se manca spazio (niente titoli
  // orfani in fondo alla pagina).
  const titolo = (t) => {
    if (y > 250) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(...VERDE);
    doc.text(t, M, y); y += 4;
  };
  const tabella = (head, body) => {
    autoTable(doc, { ...base, startY: y, head: [head], body: body.length ? body : [head.map((_, i) => (i === 0 ? "—" : ""))] });
    y = doc.lastAutoTable.finalY + 8;
  };

  // Intestazione
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...INK);
  doc.text(`Fascicolo ${pratica.codice || ""}`, M, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 94, 84);
  doc.text(`Programma Carbon WastePrint · Fondazione Operate · esportato il ${esportatoIl}`, M, y); y += 8;

  titolo("Dati della pratica");
  tabella(["Voce", "Valore"], [
    ["Tipo", pratica.tipo === "rapporto" ? `Rapporto di Monitoraggio anno ${pratica.anno_monitoraggio}` : "Progetto"],
    ["Titolo", pratica.titolo || "—"],
    ["Organizzazione", pratica.organizzazione?.denominazione || "—"],
    ["Stato", stato(pratica.stato) + (pratica.motivazione_stato ? ` — ${pratica.motivazione_stato}` : "")],
    ["Ente di Validazione", pratica.ente?.denominazione || "non assegnato"],
    ["Creata il", dataIt(pratica.creato_il)],
    ["Da conservare fino al", pratica.conservare_fino_al ? dataIt(pratica.conservare_fino_al) : "— (pratica non conclusa)"],
  ]);

  titolo("Fasi");
  tabella(["N.", "Fase", "Stato", "Apertura", "Scadenza", "Chiusura"], fasi.map((f) => [
    f.numero, f.nome, stato(f.stato), dataIt(f.data_apertura), dataIt(f.data_prevista_chiusura), dataIt(f.data_effettiva_chiusura),
  ]));

  titolo(`Documenti (${documenti.length}, tutte le versioni)`);
  tabella(["Documento", "Vers.", "Tipologia", "Fase", "Caricato il", "SHA-256 (inizio)"], documenti.map((d) => [
    d.nome, `v${d.versione}${d.corrente ? "" : " (prec.)"}`, d.tipologia || "—", d.fase_id ? nomeFase[d.fase_id] || "—" : "Generale",
    dataOraIt(d.creato_il), d.hash_file ? d.hash_file.slice(0, 16) + "…" : "—",
  ]));

  if (integrazioni.length) {
    titolo("Richieste di integrazione");
    tabella(["Fase", "Richiesta", "Richiesta il", "Risposta", "Chiusa"], integrazioni.map((r) => [
      nomeFase[r.fase_id] || "—", r.descrizione, dataIt(r.creato_il),
      r.documento ? `${r.documento.nome} v${r.documento.versione}` : "—", r.risolta ? "sì" : "no",
    ]));
  }

  consultazioni.forEach((c, i) => {
    titolo(`Consultazione pubblica ${consultazioni.length > 1 ? i + 1 : ""}`.trim());
    const pub = documenti.find((d) => d.id === c.documento_id);
    tabella(["Voce", "Valore"], [
      ["Periodo", `dal ${dataIt(c.data_apertura)} al ${dataIt(c.data_chiusura)} (${c.attiva ? "attiva" : "chiusa"})`],
      ["Documento pubblicato", pub ? `${pub.nome} v${pub.versione}` : "—"],
      ["Errata corrige", (c.errata || []).length ? c.errata.map((e) => `${dataIt(e.creato_il)}: ${e.testo}${e.riparte ? " (30 giorni ripartiti)" : ""}`).join("\n") : "nessuna"],
    ]);
    tabella(["N.", "Data", "Osservazione (anonima)", "Stato", "Risposta del Comune"], (c.commenti || []).map((o) => [
      o.numero || "—", dataIt(o.creato_il), o.testo, stato(o.stato) + (staff && o.motivazione_moderazione ? ` — ${o.motivazione_moderazione}` : ""), o.risposta_testo || "—",
    ]));
  });

  if (staff) {
    titolo("Pagamenti");
    tabella(["Voce", "Importo", "Scadenza", "Pagato", "Data", "Riferimento", "Registrato da"], pagamenti.map((p) => [
      p.descrizione, euro(p.importo), dataIt(p.scadenza), p.pagato ? "sì" : "no", dataIt(p.data_pagamento), p.riferimento || "—", nomi[p.registrato_da] || "—",
    ]));
    titolo(`Storico delle operazioni (${audit.length})`);
    tabella(["Data e ora", "Utente", "Operazione", "Da", "A", "Motivazione"], [...audit].reverse().map((a) => [
      dataOraIt(a.avvenuto_il), `${nomi[a.utente_id] || "—"}${a.ruolo ? ` (${a.ruolo})` : ""}`, a.operazione,
      a.stato_precedente || "", a.stato_successivo || "", a.motivazione || "",
    ]));
  }

  // Piè di pagina su ogni pagina.
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120);
    doc.text(`Fascicolo ${pratica.codice || ""} · pagina ${p} di ${n}`, W - M, 290, { align: "right" });
  }
  return doc.output("blob");
}
