/* =========================================================================
   archivio.js — lettura e salvataggio dei calcoli dei crediti (tabelle dello script 11).

   Scopo: crea, legge, aggiorna ed elimina i calcoli (testata e dati in
   calcolo_crediti) e la loro Banca Dati Utenze (righe di conferimento e di
   riuso), anche quando le righe sono centinaia di migliaia (invio e
   lettura a blocchi). Crea le nuove versioni di un calcolo confermato.

   Usato da: src/pages/Crediti.jsx (elenco, creazione) e
   src/pages/CalcoloCrediti.jsx (tutto il resto).

   Dati/servizi coinvolti: tabelle calcolo_crediti, calcolo_conferimento,
   calcolo_riuso (11_crediti.sql; numero di registro e regole aggiornate in
   18_registro_crediti.sql).

   Sicurezza: accessibili solo agli Amministratori con verifica a due
   fattori (policy calcolo_admin, conferimento_admin, riuso_admin con
   app_is_admin). Un calcolo confermato è immutabile: il trigger
   calcolo_immutabile rifiuta modifiche e cancellazioni, anche delle sue
   righe di dettaglio. Il numero di registro CWP-REG-AAAA-NNNN lo assegna il
   database alla conferma (solo ex post), mai il portale.
   Audit: trigger trg_audit su calcolo_crediti (non riga per riga sul dettaglio).

   Registro sviluppo e deploy: capitolo 4 «Database» (script 11 e 18);
   capitolo 15 «Calcolo crediti».
   ========================================================================= */
import { supabase } from "../supabase.js";
import { TIPOLOGIE_RIFIUTO, BENI_RIUSO, BUFFER_SOLO_VIRTUOSE } from "./parametri.js";
import { valoriNonAmmessiBdu } from "./calcolo.js";

// Righe per invio / lettura: 1000 è anche il massimo che l'API di Supabase
// restituisce per richiesta (impostazione predefinita).
const BLOCCO = 1000; // righe per invio / lettura

// Dati iniziali di un nuovo calcolo: fattori e parametri della Metodologia.
// Restituisce l'oggetto da salvare in calcolo_crediti.dati: tabelle vuote,
// fattori e beni copiati da parametri.js (scenario "riutilizzo"), buffer con
// tutte le utenze monitorate e il solo indifferenziato misurato.
// La copia rende il calcolo indipendente da modifiche future dei default.
export function datiIniziali() {
  return {
    rifiuti: [],
    pefUd: "",
    pefUnd: "",
    classiUd: [],
    classiUnd: [],
    fattori: TIPOLOGIE_RIFIUTO.map((t) => ({
      id: t.id,
      nome: t.nome,
      fe: t.fe,
      ps: t.ps,
      recupero: t.recupero,
      calcolato: !!t.calcolato,
      fonte: t.fonte,
    })),
    scenarioRiuso: "riutilizzo",
    beni: BENI_RIUSO.map((b) => ({ id: b.id, nome: b.nome, peso: b.peso, fe: b.feRiutilizzo })),
    psConsuntivo: false,
    volumiCentralizzati: {},
    opzioni: {
      soloVirtuose: false,
      bufferVirtuose: BUFFER_SOLO_VIRTUOSE,
      utenzeMonitorate: { res: true, nonres: true, und: true },
      categorieUndNonMonitorate: 0,
      rifiutiMisurati: { indifferenziato: true },
      misuraCentralizzate: false,
      misuraAltriNonCentralizzati: false,
      tariffaPuntuale: false,
      bufferManuale: "",
      motivazioneBuffer: "",
    },
  };
}

// Elenco dei calcoli (senza dati né risultato) con pratica e organizzazione,
// dal più recente. Tabella calcolo_crediti.
export async function elencaCalcoli() {
  return await supabase
    .from("calcolo_crediti")
    .select("id, pratica_id, titolo, anno, tipo, stato, numero_registro, crediti_lordi, crediti_netti, buffer_pct, calcolato_il, aggiornato_il, versione_di, pratica:pratica_id (codice, tipo, anno_monitoraggio, organizzazione:organizzazione_id (denominazione))")
    .order("aggiornato_il", { ascending: false });
}

// Un calcolo completo (testata, dati, risultato) con la sua pratica.
// La Banca Dati Utenze si legge a parte con leggiConferimenti / leggiRiuso.
export async function leggiCalcolo(id) {
  return await supabase
    .from("calcolo_crediti")
    .select("*, pratica:pratica_id (codice, tipo, titolo, anno_monitoraggio, organizzazione:organizzazione_id (denominazione))")
    .eq("id", id)
    .single();
}

// Crea un nuovo calcolo in bozza. Parametri: pratica, titolo, anno, tipo
// ("ex_ante" | "ex_post"), data di avvio (primo anno parziale), dati
// (predefiniti: datiIniziali()), versioneDi = id del calcolo di origine.
// Effetti: riga in calcolo_crediti e voce di audit (trigger).
export async function creaCalcolo({ praticaId, titolo, anno, tipo, dataAvvio = null, dati = null, versioneDi = null }) {
  return await supabase
    .from("calcolo_crediti")
    .insert({
      pratica_id: praticaId,
      titolo,
      anno,
      tipo,
      data_avvio: dataAvvio || null,
      dati: dati || datiIniziali(),
      versione_di: versioneDi,
    })
    .select()
    .single();
}

// Aggiorna i campi di un calcolo (dati, risultato, totali, stato).
// Con stato = "confermato" il database registra chi e quando conferma e,
// per gli ex post, assegna il numero di registro (18_registro_crediti.sql).
// Rifiutato se il calcolo è già confermato.
export async function salvaCalcolo(id, campi) {
  return await supabase.from("calcolo_crediti").update(campi).eq("id", id).select().single();
}

// Elimina un calcolo in bozza; le righe di dettaglio si cancellano a cascata.
// Un calcolo confermato non si può eliminare (trigger calcolo_immutabile).
export async function eliminaCalcolo(id) {
  return await supabase.from("calcolo_crediti").delete().eq("id", id);
}

// Legge tutte le righe di una tabella di dettaglio, a blocchi.
// L'ordine per id rende stabile la paginazione con range(). Si ferma al
// primo blocco incompleto. Restituisce { data: righe del database, error }.
async function leggiTutto(tabella, calcoloId) {
  const tutte = [];
  for (let da = 0; ; da += BLOCCO) {
    const { data, error } = await supabase
      .from(tabella)
      .select("*")
      .eq("calcolo_id", calcoloId)
      .order("id", { ascending: true })
      .range(da, da + BLOCCO - 1);
    if (error) return { data: null, error };
    tutte.push(...(data || []));
    if (!data || data.length < BLOCCO) break;
  }
  return { data: tutte, error: null };
}

// Sostituisce tutte le righe di una tabella di dettaglio.
// Prima cancella, poi inserisce a blocchi; onAvanzamento(fatte, totale)
// aggiorna la barra di avanzamento. Non è una transazione (una sola
// chiamata non reggerebbe centinaia di migliaia di righe): se un blocco
// fallisce, nel database resta solo una parte delle righe e ripetere il
// salvataggio le sostituisce di nuovo tutte. Un salvataggio a metà non si
// può però confermare (20_rinforzi_integrita.sql): ogni modifica delle
// righe azzera il risultato salvato del calcolo e, alla conferma, il
// database controlla che le righe salvate siano quante quelle usate nel
// calcolo (risultato.righe, scritto da «Calcola» in CalcoloCrediti.jsx).
async function sostituisci(tabella, calcoloId, righe, onAvanzamento) {
  const { error: e1 } = await supabase.from(tabella).delete().eq("calcolo_id", calcoloId);
  if (e1) return { error: e1 };
  for (let i = 0; i < righe.length; i += BLOCCO) {
    onAvanzamento && onAvanzamento(Math.min(i + BLOCCO, righe.length), righe.length);
    const blocco = righe.slice(i, i + BLOCCO).map((r) => ({ ...r, calcolo_id: calcoloId }));
    const { error } = await supabase.from(tabella).insert(blocco);
    if (error) return { error };
  }
  return { error: null };
}

// Conversione tra righe del database e oggetti del motore di calcolo.
// Database: nomi con trattino basso (peso_strutture); motore: camelCase
// (pesoStrutture). Utenza e classe si salvano sempre come testo; i campi
// assenti diventano null (non 0), n_utenze vale almeno 1.
const daDbConferimento = (r) => ({
  utenza: r.utenza,
  macro: r.macro,
  classe: r.classe,
  tipologia: r.tipologia,
  svuotamenti: r.svuotamenti,
  volume: r.volume,
  pesoStrutture: r.peso_strutture,
  volumeStrutture: r.volume_strutture,
  pesoCdr: r.peso_cdr,
  volumeCdr: r.volume_cdr,
  nUtenze: Number(r.n_utenze) || 1,
});
const aDbConferimento = (c) => ({
  utenza: String(c.utenza),
  macro: c.macro,
  classe: String(c.classe),
  tipologia: c.tipologia,
  svuotamenti: c.svuotamenti ?? null,
  volume: c.volume ?? null,
  peso_strutture: c.pesoStrutture ?? null,
  volume_strutture: c.volumeStrutture ?? null,
  peso_cdr: c.pesoCdr ?? null,
  volume_cdr: c.volumeCdr ?? null,
  n_utenze: c.nUtenze || 1,
});
const daDbRiuso = (r) => ({
  utenza: r.utenza,
  macro: r.macro,
  classe: r.classe,
  bene: r.bene,
  pezzi: r.pezzi,
  peso: r.peso,
  nUtenze: Number(r.n_utenze) || 1,
});
const aDbRiuso = (c) => ({
  utenza: String(c.utenza),
  macro: c.macro,
  classe: String(c.classe),
  bene: c.bene,
  pezzi: c.pezzi ?? null,
  peso: c.peso ?? null,
  n_utenze: c.nUtenze || 1,
});

// Conferimenti della Banca Dati Utenze di un calcolo (tabella calcolo_conferimento).
export async function leggiConferimenti(calcoloId) {
  const { data, error } = await leggiTutto("calcolo_conferimento", calcoloId);
  return { data: data ? data.map(daDbConferimento) : null, error };
}
// Sostituisce tutti i conferimenti di un calcolo in bozza. Restituisce { error }.
// Prima di scrivere si controllano i valori (collaudo V01, D07): con un
// valore negativo o non numerico non si cancella né si scrive nulla e la
// Banca Dati salvata resta quella di prima. Lo stesso controllo è nei
// vincoli del database (script 35).
function erroreValori(conferimenti, riuso) {
  const v = valoriNonAmmessiBdu({ conferimenti, riuso });
  if (!v.righe) return null;
  return { message: `${v.righe} righe con valori negativi o non numerici (es. ${v.messaggi.slice(0, 3).join("; ")}): nessuna riga salvata, la Banca Dati Utenze resta quella di prima.` };
}
export async function salvaConferimenti(calcoloId, righe, onAvanzamento) {
  const errore = erroreValori(righe, []);
  if (errore) return { error: errore };
  return await sostituisci("calcolo_conferimento", calcoloId, righe.map(aDbConferimento), onAvanzamento);
}
// Beni a riuso della Banca Dati Utenze di un calcolo (tabella calcolo_riuso).
export async function leggiRiuso(calcoloId) {
  const { data, error } = await leggiTutto("calcolo_riuso", calcoloId);
  return { data: data ? data.map(daDbRiuso) : null, error };
}
// Sostituisce tutte le righe di riuso di un calcolo in bozza. Restituisce { error }.
export async function salvaRiuso(calcoloId, righe, onAvanzamento) {
  const errore = erroreValori([], righe);
  if (errore) return { error: errore };
  return await sostituisci("calcolo_riuso", calcoloId, righe.map(aDbRiuso), onAvanzamento);
}

// Nuova versione (bozza) di un calcolo: copia dati e Banca Dati Utenze.
// Serve per correggere un calcolo confermato senza toccarlo: la copia
// porta versione_di = id dell'originale e titolo con "(rev.)". Il
// risultato non si copia: va ricalcolato. Restituisce { data: nuovo calcolo,
// error }. RPC `admin_nuova_versione_calcolo` (20_rinforzi_integrita.sql):
// copia tutto nel database in un'unica operazione (o tutto o niente).
export async function nuovaVersione(calcolo) {
  return await supabase.rpc("admin_nuova_versione_calcolo", { p_calcolo: calcolo.id });
}
