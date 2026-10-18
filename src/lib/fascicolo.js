/* =========================================================================
   fascicolo.js — export del fascicolo di una pratica (requisiti §11).

   Scopo: ZIP con: dati della pratica, fasi, tutti i documenti in tutte le versioni,
   integrazioni, consultazione (documento pubblicato, osservazioni, risposte),
   pagamenti e audit (questi ultimi due solo nell'export dello staff: l'audit
   lo legge solo lo staff; i pagamenti dallo script 17 li vede anche il Comune,
   ma restano fuori dal suo export), più un riepilogo leggibile (LEGGIMI.txt).
   Tutto avviene nel browser: nessun file passa da un server proprio.

   Usato da: src/components/DettaglioPratica.jsx (pulsante di export).

   Dati/servizi coinvolti: le letture di src/lib/dati.js (tabelle pratica,
   fase, documento, richiesta_integrazione, consultazione, commento,
   pagamento, audit_event) e l'archivio Storage `documenti` (download dei
   file). Nessuna scrittura nel database.

   Sicurezza: il fascicolo contiene solo ciò che le regole RLS mostrano
   all'utente. Le osservazioni sono anonime (COLONNE_COMMENTO di dati.js
   non contiene nome né email dell'autore).

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)»; capitolo 7
   «Funzionalità per area» (Export fascicolo).
   ========================================================================= */
import { supabase } from "./supabase.js";
import { oggiItalia } from "./date.js";
import {
  leggiPratica,
  elencaDocumenti,
  elencaIntegrazioni,
  leggiConsultazione,
  elencaPagamenti,
  elencaAudit,
} from "./dati.js";

// CSV con separatore ";" (si apre direttamente in Excel in italiano).
// Parametri: righe (oggetti) e colonne = [[chiave o funzione(riga), titolo], …].
// Gli oggetti annidati diventano JSON. Restituisce il testo con BOM.
// (Simile a scriviCsv di csv.js, ma qui i numeri restano col punto.)
function csv(righe, colonne) {
  const cella = (v) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const testa = colonne.map(([, titolo]) => cella(titolo)).join(";");
  const corpo = righe.map((r) => colonne.map(([k]) => cella(typeof k === "function" ? k(r) : r[k])).join(";"));
  // BOM: Excel riconosce gli accenti.
  return "﻿" + [testa, ...corpo].join("\r\n");
}

// Nome di file sicuro: toglie i caratteri vietati da Windows (\ / : * ? " < > |)
// e taglia a 120 caratteri. Accenti e spazi singoli restano.
function pulisci(nome) {
  return (nome || "documento").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
}

// Aggiunge la versione prima dell'estensione: "Relazione.pdf", 2 → "Relazione_v2.pdf".
function conVersione(nomeFile, versione) {
  const i = nomeFile.lastIndexOf(".");
  return i > 0 ? `${nomeFile.slice(0, i)}_v${versione}${nomeFile.slice(i)}` : `${nomeFile}_v${versione}`;
}

/* Prepara e scarica il fascicolo. onAvanzamento(testo) riceve i passi.
   Parametri: id della pratica; staff = true per includere pagamenti e audit.
   Restituisce { documenti: numero, mancanti: [nomi non scaricati] }.
   Lancia un errore se la pratica non si legge.
   Nota: i file si scaricano uno alla volta e restano in memoria fino alla
   compressione; con molti documenti grandi può essere lento. */
export async function esportaFascicolo(praticaId, { staff, onAvanzamento = () => {} } = {}) {
  onAvanzamento("Raccolta dei dati…");
  const { data: pratica, error } = await leggiPratica(praticaId);
  if (error || !pratica) throw new Error(error?.message || "Pratica non trovata");

  // Letture in parallelo; per il cliente pagamenti e audit non si chiedono.
  const [docRes, intRes, consRes, pagRes, audRes] = await Promise.all([
    elencaDocumenti(praticaId),
    elencaIntegrazioni(praticaId),
    leggiConsultazione(praticaId),
    staff ? elencaPagamenti(praticaId) : Promise.resolve({ data: [] }),
    staff ? elencaAudit({ praticaId, limite: 10000 }) : Promise.resolve({ data: [] }),
  ]);
  const documenti = docRes.data || [];
  const integrazioni = intRes.data || [];
  const consultazione = consRes.data;
  const pagamenti = pagRes.data || [];
  const audit = audRes.data || [];
  const fasi = (pratica.fasi || []).sort((a, b) => a.numero - b.numero);
  const nomeFase = Object.fromEntries(fasi.map((f) => [f.id, `${f.numero} - ${f.nome}`]));

  // La libreria ZIP si carica solo quando serve.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const radice = zip.folder(pulisci(`Fascicolo ${pratica.codice || pratica.id}`));

  // Documenti: tutte le versioni, in cartelle per fase.
  // Un file non scaricabile non blocca l'export: finisce nell'elenco
  // "mancanti", riportato nel LEGGIMI.txt e restituito alla pagina.
  const mancanti = [];
  for (let i = 0; i < documenti.length; i++) {
    const d = documenti[i];
    onAvanzamento(`Documenti ${i + 1} di ${documenti.length}…`);
    const cartella = d.fase_id ? `Documenti/Fase ${pulisci(nomeFase[d.fase_id] || "?")}` : "Documenti/Generali";
    const nomeFile = conVersione(pulisci(d.nome), d.versione);
    if (!d.storage_path) {
      mancanti.push(d.nome);
      continue;
    }
    const { data: blob, error: e } = await supabase.storage.from("documenti").download(d.storage_path);
    if (e || !blob) mancanti.push(`${d.nome} v${d.versione}`);
    else radice.file(`${cartella}/${nomeFile}`, blob);
  }

  onAvanzamento("Riepiloghi…");
  radice.file(
    "pratica.csv",
    csv([pratica], [
      ["codice", "Codice"],
      ["tipo", "Tipo"],
      ["titolo", "Titolo"],
      [(p) => p.organizzazione?.denominazione, "Organizzazione"],
      ["anno_monitoraggio", "Anno di monitoraggio"],
      ["stato", "Stato"],
      ["motivazione_stato", "Motivazione stato"],
      ["creato_il", "Creata il"],
    ])
  );
  radice.file(
    "fasi.csv",
    csv(fasi, [
      ["numero", "N."],
      ["nome", "Fase"],
      ["stato", "Stato"],
      ["responsabile", "Responsabile"],
      ["data_apertura", "Apertura"],
      ["data_prevista_chiusura", "Scadenza prevista"],
      ["data_effettiva_chiusura", "Chiusura effettiva"],
      ["note", "Note"],
    ])
  );
  radice.file(
    "documenti.csv",
    csv(documenti, [
      ["nome", "Documento"],
      ["versione", "Versione"],
      [(d) => (d.corrente ? "sì" : "no"), "Corrente"],
      ["tipologia", "Tipologia"],
      [(d) => (d.fase_id ? nomeFase[d.fase_id] : "Generale"), "Fase"],
      [(d) => (d.visibile_cliente ? "sì" : "no"), "Visibile al Cliente"],
      [(d) => (d.pubblico ? "sì" : "no"), "Pubblico"],
      ["stato", "Stato"],
      ["creato_il", "Caricato il"],
      ["hash_file", "Hash SHA-256"],
    ])
  );
  if (integrazioni.length) {
    radice.file(
      "integrazioni.csv",
      csv(integrazioni, [
        [(r) => nomeFase[r.fase_id], "Fase"],
        ["descrizione", "Richiesta"],
        ["creato_il", "Richiesta il"],
        [(r) => r.documento && `${r.documento.nome} v${r.documento.versione}`, "Documento di risposta"],
        ["nota_risposta", "Nota del Cliente"],
        ["risposto_il", "Risposta il"],
        [(r) => (r.risolta ? "sì" : "no"), "Chiusa"],
        ["risolta_il", "Chiusa il"],
      ])
    );
  }
  if (consultazione) {
    const pubblicato = documenti.find((d) => d.id === consultazione.documento_id);
    radice.file(
      "consultazione.csv",
      csv(consultazione.commenti || [], [
        ["creato_il", "Data"],
        ["testo", "Osservazione (anonima)"],
        ["stato", "Stato"],
        ["motivazione_moderazione", "Motivazione moderazione"],
        ["risposta_testo", "Risposta del Cliente"],
      ])
    );
    radice.file(
      "consultazione_info.txt",
      [
        `Periodo: dal ${consultazione.data_apertura || "—"} al ${consultazione.data_chiusura || "—"}`,
        `Stato: ${consultazione.attiva ? "attiva" : "chiusa"}`,
        `Documento pubblicato: ${pubblicato ? `${pubblicato.nome} v${pubblicato.versione}` : "—"}`,
      ].join("\r\n")
    );
  }
  if (staff) {
    radice.file(
      "pagamenti.csv",
      csv(pagamenti, [
        ["descrizione", "Voce"],
        ["importo", "Importo (€)"],
        ["scadenza", "Scadenza"],
        [(p) => (p.pagato ? "sì" : "no"), "Pagato"],
        ["data_pagamento", "Data pagamento"],
        ["riferimento", "Riferimento"],
      ])
    );
    radice.file(
      "audit.csv",
      // elencaAudit restituisce dal più recente: qui in ordine cronologico.
      csv([...audit].reverse(), [
        ["avvenuto_il", "Data e ora"],
        ["ruolo", "Ruolo"],
        ["utente_id", "Utente (id)"],
        ["operazione", "Operazione"],
        ["oggetto_tipo", "Oggetto"],
        ["stato_precedente", "Da"],
        ["stato_successivo", "A"],
        ["motivazione", "Motivazione"],
      ])
    );
  }

  const oggi = new Date().toLocaleString("it-IT");
  radice.file(
    "LEGGIMI.txt",
    [
      `FASCICOLO ${pratica.codice || ""} — Programma Carbon WastePrint`,
      `Organizzazione: ${pratica.organizzazione?.denominazione || "—"}`,
      `Pratica: ${pratica.tipo === "rapporto" ? `Rapporto di Monitoraggio anno ${pratica.anno_monitoraggio}` : "Progetto"} — ${pratica.titolo || ""}`,
      `Stato: ${pratica.stato}`,
      `Esportato il: ${oggi}`,
      "",
      "Contenuto:",
      `- Documenti/: ${documenti.length} file (tutte le versioni, per fase)`,
      "- pratica.csv, fasi.csv, documenti.csv (con hash SHA-256 di ogni file)",
      integrazioni.length ? "- integrazioni.csv" : null,
      consultazione ? "- consultazione.csv e consultazione_info.txt (osservazioni in forma anonima)" : null,
      staff ? "- pagamenti.csv, audit.csv (storico completo delle operazioni)" : "- (pagamenti e audit sono inclusi solo nell'export del back-office)",
      mancanti.length ? `\nATTENZIONE — file non recuperati: ${mancanti.join(", ")}` : null,
      "\nI file .csv usano il punto e virgola come separatore e si aprono con Excel.",
    ]
      .filter((r) => r !== null)
      .join("\r\n")
  );

  // Compressione e download con un collegamento temporaneo (come scaricaTesto di csv.js).
  onAvanzamento("Compressione…");
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = pulisci(`Fascicolo_${pratica.codice || pratica.id}_${oggiItalia()}`) + ".zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { documenti: documenti.length, mancanti };
}
