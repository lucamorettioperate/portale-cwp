/* =========================================================================
   fascicolo.js — export del fascicolo di una pratica (requisiti §11).

   Scopo: ZIP con: riepilogo PDF (Riepilogo.pdf, src/lib/fascicoloPdf.js),
   dati della pratica con l'Ente di Validazione, fasi, tutti i documenti in
   tutte le versioni (cartella Validazione per il rapporto dell'Ente; per i
   Rapporti anche il contratto del Progetto), integrazioni, tutte le
   consultazioni (documento pubblicato, errata corrige, osservazioni con
   allegati, risposte), note di fase, messaggi, pagamenti e audit con i
   nomi degli utenti (questi ultimi due solo nell'export dello staff:
   l'audit lo legge solo lo staff; i pagamenti li vede anche il Comune, ma
   restano fuori dal suo export), più LEGGIMI.txt.
   Tutto avviene nel browser: nessun file passa da un server proprio.

   Usato da: src/components/DettaglioPratica.jsx (pulsante di export).

   Dati/servizi coinvolti: le letture di src/lib/dati.js (tabelle pratica,
   fase, documento, richiesta_integrazione, consultazione, commento,
   consultazione_errata, nota_fase, messaggio, pagamento, audit_event,
   profilo) e gli archivi Storage `documenti` e `allegati-consultazione`
   (download dei file). Nessuna scrittura nel database.

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
  elencaConsultazioniComplete,
  elencaNoteFase,
  elencaMessaggi,
  elencaPagamenti,
  elencaAudit,
  nomiUtenti,
} from "./dati.js";

// Tipologie che finiscono in cartelle dedicate del fascicolo.
const TIPO_RAPPORTO_ENTE = "Rapporto dell'Ente di Validazione";
const TIPI_CONTRATTO = ["Contratto", "Allegato al contratto"];

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
  // Per un Rapporto si prendono anche contratto e allegati del Progetto.
  const [docRes, intRes, consRes, noteRes, msgRes, pagRes, audRes, padreRes] = await Promise.all([
    elencaDocumenti(praticaId),
    elencaIntegrazioni(praticaId),
    elencaConsultazioniComplete(praticaId),
    elencaNoteFase(praticaId),
    elencaMessaggi(praticaId),
    staff ? elencaPagamenti(praticaId) : Promise.resolve({ data: [] }),
    staff ? elencaAudit({ praticaId, limite: 10000 }) : Promise.resolve({ data: [] }),
    pratica.tipo === "rapporto" && pratica.progetto_padre_id ? elencaDocumenti(pratica.progetto_padre_id, null) : Promise.resolve({ data: [] }),
  ]);
  const documenti = docRes.data || [];
  const integrazioni = intRes.data || [];
  const consultazioni = consRes.data || [];
  const note = noteRes.data || [];
  const messaggi = msgRes.data || [];
  const pagamenti = pagRes.data || [];
  const audit = audRes.data || [];
  const contrattiProgetto = (padreRes.data || []).filter((d) => TIPI_CONTRATTO.includes(d.tipologia));
  // Nomi degli utenti dello storico e dei pagamenti (solo staff).
  const nomi = staff ? await nomiUtenti([...audit.map((a) => a.utente_id), ...pagamenti.map((p) => p.registrato_da)]) : {};
  const fasi = (pratica.fasi || []).sort((a, b) => a.numero - b.numero);
  const nomeFase = Object.fromEntries(fasi.map((f) => [f.id, `${f.numero} - ${f.nome}`]));

  // La libreria ZIP si carica solo quando serve.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const radice = zip.folder(pulisci(`Fascicolo ${pratica.codice || pratica.id}`));

  // Documenti: tutte le versioni, in cartelle per fase; il rapporto
  // dell'Ente di Validazione in «Validazione», il contratto del Progetto
  // (solo per i Rapporti) in «Contratto del Progetto».
  // Un file non scaricabile non blocca l'export: finisce nell'elenco
  // "mancanti", riportato nel LEGGIMI.txt e restituito alla pagina.
  const mancanti = [];
  const cartellaDi = (d) =>
    d.tipologia === TIPO_RAPPORTO_ENTE ? "Validazione"
      : d.fase_id ? `Documenti/Fase ${pulisci(nomeFase[d.fase_id] || "?")}` : "Documenti/Generali";
  const daScaricare = [
    ...documenti.map((d) => ({ d, cartella: cartellaDi(d) })),
    ...contrattiProgetto.map((d) => ({ d, cartella: "Contratto del Progetto" })),
  ];
  for (let i = 0; i < daScaricare.length; i++) {
    const { d, cartella } = daScaricare[i];
    onAvanzamento(`Documenti ${i + 1} di ${daScaricare.length}…`);
    const nomeFile = conVersione(pulisci(d.nome), d.versione);
    if (!d.storage_path) {
      mancanti.push(d.nome);
      continue;
    }
    const { data: blob, error: e } = await supabase.storage.from("documenti").download(d.storage_path);
    if (e || !blob) mancanti.push(`${d.nome} v${d.versione}`);
    else radice.file(`${cartella}/${nomeFile}`, blob);
  }

  // Allegati delle osservazioni (archivio «allegati-consultazione»): il
  // Comune scarica solo quelli delle osservazioni ammesse (RLS, script 17).
  const allegati = consultazioni.flatMap((c, i) => (c.commenti || []).filter((o) => o.allegato_path).map((o) => ({ o, n: i + 1 })));
  for (const { o, n } of allegati) {
    const { data: blob, error: e } = await supabase.storage.from("allegati-consultazione").download(o.allegato_path);
    const nome = pulisci(`Osservazione ${o.numero || "?"} - ${o.allegato_nome || "allegato"}`);
    if (e || !blob) mancanti.push(`allegato dell'osservazione n. ${o.numero || "?"}`);
    else radice.file(`Consultazione${consultazioni.length > 1 ? ` ${n}` : ""}/Allegati/${nome}`, blob);
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
      [(p) => p.ente?.denominazione, "Ente di Validazione"],
      ["creato_il", "Creata il"],
      ["conservare_fino_al", "Da conservare fino al"],
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
      [cartellaDi, "Cartella"],
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
  // Una cartella per consultazione (di solito una sola).
  consultazioni.forEach((c, i) => {
    const cartella = `Consultazione${consultazioni.length > 1 ? ` ${i + 1}` : ""}`;
    const pubblicato = documenti.find((d) => d.id === c.documento_id);
    radice.file(
      `${cartella}/osservazioni.csv`,
      csv(c.commenti || [], [
        ["numero", "N."],
        ["creato_il", "Data"],
        ["testo", "Osservazione (anonima)"],
        ["stato", "Stato"],
        ...(staff ? [["motivazione_moderazione", "Motivazione moderazione"]] : []),
        ["allegato_nome", "Allegato"],
        ["risposta_testo", "Risposta del Cliente"],
      ])
    );
    if ((c.errata || []).length) {
      radice.file(
        `${cartella}/errata_corrige.csv`,
        csv(c.errata, [
          ["creato_il", "Data"],
          ["testo", "Correzione"],
          [(e) => e.documento && `${e.documento.nome} v${e.documento.versione}`, "Documento"],
          [(e) => (e.riparte ? "sì" : "no"), "30 giorni ripartiti"],
          ["nuova_chiusura", "Chiusura dopo la correzione"],
          ["motivazione", "Motivazione"],
        ])
      );
    }
    radice.file(
      `${cartella}/info.txt`,
      [
        `Periodo: dal ${c.data_apertura || "—"} al ${c.data_chiusura || "—"}`,
        `Stato: ${c.attiva ? "attiva" : "chiusa"}`,
        `Documento pubblicato: ${pubblicato ? `${pubblicato.nome} v${pubblicato.versione}` : "—"}`,
        `Errata corrige: ${(c.errata || []).length}`,
      ].join("\r\n")
    );
  });
  if (note.length) {
    radice.file(
      "note_di_fase.csv",
      csv(note, [
        [(n) => nomeFase[n.fase_id], "Fase"],
        ["creato_il", "Data"],
        ["autore_nome", "Autore"],
        [(n) => (n.visibile_cliente ? "condivisa con il Cliente" : "interna"), "Visibilità"],
        ["testo", "Nota"],
      ])
    );
  }
  if (messaggi.length) {
    radice.file(
      "messaggi.csv",
      csv(messaggi, [
        ["creato_il", "Data"],
        ["autore_nome", "Autore"],
        [(m) => (m.autore_ruolo === "cliente" ? "Comune" : "Fondazione"), "Da"],
        ["testo", "Messaggio"],
      ])
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
        [(p) => nomi[p.registrato_da], "Registrato da"],
      ])
    );
    radice.file(
      "audit.csv",
      // elencaAudit restituisce dal più recente: qui in ordine cronologico.
      csv([...audit].reverse(), [
        ["avvenuto_il", "Data e ora"],
        [(a) => nomi[a.utente_id] || "", "Utente"],
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

  // Riepilogo PDF (jsPDF si scarica solo ora).
  onAvanzamento("Riepilogo PDF…");
  const { generaRiepilogoPdf } = await import("./fascicoloPdf.js");
  radice.file("Riepilogo.pdf", generaRiepilogoPdf({
    pratica, fasi, nomeFase, documenti, integrazioni, consultazioni, pagamenti, audit, nomi, staff, esportatoIl: oggi,
  }));
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
      "- Riepilogo.pdf: sintesi leggibile del fascicolo",
      `- Documenti/: ${documenti.length} file (tutte le versioni, per fase)`,
      documenti.some((d) => d.tipologia === TIPO_RAPPORTO_ENTE) ? "- Validazione/: rapporto dell'Ente di Validazione" : null,
      contrattiProgetto.length ? "- Contratto del Progetto/: contratto e allegati del Progetto a cui appartiene il Rapporto" : null,
      "- pratica.csv, fasi.csv, documenti.csv (con hash SHA-256 di ogni file)",
      integrazioni.length ? "- integrazioni.csv" : null,
      consultazioni.length ? "- Consultazione/: osservazioni (in forma anonima) con allegati, errata corrige, info.txt" : null,
      note.length ? "- note_di_fase.csv" : null,
      messaggi.length ? "- messaggi.csv" : null,
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
