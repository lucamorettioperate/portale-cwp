/* =========================================================================
   dati.js — strato di accesso ai dati: legge e scrive su Supabase.

   Scopo: raccoglie in un solo posto tutte le letture e scritture del
   portale su tabelle, funzioni del database (RPC), archivi (Storage) ed
   Edge Functions, esclusi il calcolo crediti (src/lib/crediti/archivio.js)
   e l'autenticazione (src/lib/AuthContext.jsx).
   Tutte le funzioni restituiscono { data, error } come il client Supabase
   (salvo nomeUtente, che restituisce direttamente il nome).

   Usato da: pagine AreaCliente, Audit, BackOffice, CalcoloCrediti, Crediti,
   Cruscotto, ConsultazioniPubbliche, GestioneUtenti, Impostazioni,
   TuoiDocumenti; componenti Consultazione, DettaglioPratica, Documenti,
   Integrazioni, Messaggi, NoteFase, Notifiche, NuovoProgetto, Pagamenti,
   Rapporti, crediti/ImportaTracciato, impostazioni/EntiValidazione,
   impostazioni/ModelliDocumento; src/lib/fascicolo.js.

   Dati/servizi coinvolti (dettaglio sopra ogni funzione):
   - tabelle create in 01_schema.sql, 09, 13 e 17; regole RLS in
     02_sicurezza.sql e negli script successivi;
   - RPC definite in 05, 06, 07, 08, 09, 10, 13, 17;
   - archivi Storage `documenti` (04_storage.sql, limiti in 14),
     `modelli` e `allegati-consultazione` (17_pratiche.sql);
   - Edge Functions crea-utente, reimposta-password, consultazione-pubblica.

   Sicurezza: il browser usa solo la chiave anon con la sessione
   dell'utente. Chi può fare cosa lo decide il database (RLS, trigger,
   funzioni "security definer" che controllano ruolo e stato della
   pratica). Un errore "row-level security" significa che la regola ha
   respinto l'operazione, non che il codice qui sia sbagliato.
   L'audit lo scrivono i trigger del database: qui non si scrive mai.

   Regola di rilascio: una funzione nuova qui che chiama una RPC nuova va
   pubblicata DOPO lo script SQL che la crea (prima il database, poi il portale).

   Registro sviluppo e deploy: capitolo 4 «Database» (script e funzioni);
   capitolo 6 «Portale (frontend)»; capitolo 8 «Procedure di rilascio».
   ========================================================================= */
import { supabase } from "./supabase.js";
import { FASI } from "./cwpProgram.js";
import { oggiItalia, aggiungiGiorni } from "./date.js";
import { verificaFile, traduciErroreArchivio } from "./file.js";

// ---- Organizzazioni ----

// Elenco delle organizzazioni (Comuni, enti, gestori) in ordine alfabetico.
// Tabella `organizzazione` (01_schema.sql); RLS org_select (06_utente_multi_org.sql):
// lo staff vede tutte, il cliente solo quelle a cui è associato.
export async function elencaOrganizzazioni() {
  return await supabase
    .from("organizzazione")
    .select("*")
    .order("denominazione", { ascending: true });
}

// Crea una nuova organizzazione e restituisce la riga inserita.
// Parametro: oggetto con le colonne di `organizzazione` (denominazione, tipo, …).
// Tabella `organizzazione` (01_schema.sql); RLS org_write (02_sicurezza.sql): solo staff.
export async function creaOrganizzazione(dati) {
  return await supabase.from("organizzazione").insert(dati).select().single();
}

// ---- Pratiche (Progetti e Rapporti) ----

// Elenca i progetti (pratiche di tipo 'progetto') con la loro organizzazione.
// Dal più recente. Tabella `pratica` (01_schema.sql); RLS pratica_select
// (06_utente_multi_org.sql): il cliente vede solo le pratiche delle sue organizzazioni.
export async function elencaProgetti() {
  return await supabase
    .from("pratica")
    .select("*, organizzazione:organizzazione_id (denominazione, tipo)")
    .eq("tipo", "progetto")
    .order("creato_il", { ascending: false });
}

// Elenca i Rapporti di Monitoraggio di un progetto, per anno crescente.
// Parametro: id del progetto padre. Tabella `pratica` (01_schema.sql), stessa RLS.
export async function elencaRapporti(progettoId) {
  return await supabase
    .from("pratica")
    .select("*")
    .eq("tipo", "rapporto")
    .eq("progetto_padre_id", progettoId)
    .order("anno_monitoraggio", { ascending: true });
}

// Legge una singola pratica con organizzazione, Ente di Validazione e fasi.
// Tabelle `pratica`, `organizzazione`, `ente_validazione`, `fase` (01_schema.sql;
// colonna pratica.ente_validazione_id). Errore se la RLS non la mostra.
export async function leggiPratica(id) {
  return await supabase
    .from("pratica")
    .select("*, organizzazione:organizzazione_id (denominazione, tipo), ente:ente_validazione_id (id, denominazione), fasi:fase (*)")
    .eq("id", id)
    .single();
}

// Crea una pratica e le sue 7 fasi in un'unica operazione (o tutto o niente).
// Parametro: colonne della pratica (tipo, organizzazione_id, codice, titolo,
// stato, progetto_padre_id, anno_monitoraggio). Restituisce { data: pratica
// creata, error }. RPC `staff_crea_pratica` (20_rinforzi_integrita.sql):
// solo staff; valgono le regole RLS pratica_write e fase_write
// (02_sicurezza.sql). Il codice CWP-AAAA-NNNN (o -RMn per i rapporti) lo
// assegna il trigger trg_pratica_codice (09_cruscotto_pagamenti_notifiche.sql).
export async function creaPratica(dati) {
  // Le 7 fasi standard (cwpProgram.js): la fase 1 "Adesione" parte già in
  // corso, le altre si aprono dal back-office con staff_apri_fase.
  const fasi = FASI.map((f) => ({
    numero: f.numero,
    nome: f.nome,
    responsabile: f.responsabile,
    stato: f.numero === 1 ? "in_corso" : "non_iniziata",
  }));
  return await supabase.rpc("staff_crea_pratica", { p_pratica: dati, p_fasi: fasi });
}

// ---- Azioni del back-office (funzioni del database, script 08) ----
// Ogni azione critica richiede una motivazione, registrata nell'audit.

// Apre una fase: data di apertura oggi, scadenza calcolata dai giorni del Programma.
// RPC `staff_apri_fase` (08_integrazioni_azioni.sql; durata letta da
// cwp_durata_fase, tabella durata_fase di 13_durata_fasi.sql). Rifiuta se la
// pratica non è attiva o la fase è già aperta. Effetti: aggiorna `fase`,
// audit e notifiche dai trigger.
export async function apriFase(faseId) {
  return await supabase.rpc("staff_apri_fase", { p_fase: faseId });
}

// Chiude una fase. La motivazione è obbligatoria solo se restano integrazioni aperte.
// RPC `staff_chiudi_fase` (08_integrazioni_azioni.sql). Effetti: fase completata,
// audit e notifiche dai trigger.
export async function chiudiFase(faseId, motivazione = null) {
  return await supabase.rpc("staff_chiudi_fase", { p_fase: faseId, p_motivazione: motivazione });
}

// Cambia la scadenza di una fase. Parametri: id fase, nuova data (aaaa-mm-gg),
// motivazione obbligatoria. RPC `staff_modifica_scadenza` (08_integrazioni_azioni.sql).
export async function modificaScadenzaFase(faseId, data, motivazione) {
  return await supabase.rpc("staff_modifica_scadenza", {
    p_fase: faseId,
    p_data: data,
    p_motivazione: motivazione,
  });
}

// Cambia lo stato di una pratica (attiva / sospesa / annullata / chiusa),
// con motivazione obbligatoria. RPC `staff_cambia_stato_pratica`
// (08_integrazioni_azioni.sql). Una pratica non attiva blocca i caricamenti
// del cliente (policy doc_insert, 08).
export async function cambiaStatoPratica(praticaId, stato, motivazione) {
  return await supabase.rpc("staff_cambia_stato_pratica", {
    p_pratica: praticaId,
    p_stato: stato,
    p_motivazione: motivazione,
  });
}

// ---- Richieste di integrazione ----

// Richieste di integrazione di una pratica, con il documento di risposta.
// Tabella `richiesta_integrazione` (01_schema.sql; RLS integr_select in
// 02_sicurezza.sql: staff e cliente della pratica).
export async function elencaIntegrazioni(praticaId) {
  return await supabase
    .from("richiesta_integrazione")
    .select("*, documento:documento_risposta_id (id, nome, versione, storage_path)")
    .eq("pratica_id", praticaId)
    .order("creato_il", { ascending: true });
}

// Lo staff chiede un'integrazione su una fase (la fase passa "in attesa di
// integrazione"). RPC `staff_richiedi_integrazione` (08_integrazioni_azioni.sql).
// Effetti: nuova richiesta, notifica ed email al cliente dai trigger (09, 12).
export async function richiediIntegrazione(faseId, descrizione) {
  return await supabase.rpc("staff_richiedi_integrazione", {
    p_fase: faseId,
    p_descrizione: descrizione,
  });
}

// Il cliente risponde a una richiesta collegando un documento già caricato
// (caricaDocumento) e una nota facoltativa.
// RPC `cliente_rispondi_integrazione` (08_integrazioni_azioni.sql).
export async function rispondiIntegrazione(richiestaId, documentoId, nota = null) {
  return await supabase.rpc("cliente_rispondi_integrazione", {
    p_richiesta: richiestaId,
    p_documento: documentoId,
    p_nota: nota,
  });
}

// Lo staff chiude una richiesta di integrazione (motivazione facoltativa).
// RPC `staff_chiudi_integrazione` (08_integrazioni_azioni.sql).
export async function chiudiIntegrazione(richiestaId, motivazione = null) {
  return await supabase.rpc("staff_chiudi_integrazione", {
    p_richiesta: richiestaId,
    p_motivazione: motivazione,
  });
}

// Aggiorna lo stato di una fase (es. apertura/chiusura).
// Scrittura diretta sulla tabella `fase` (RLS fase_write, 02_sicurezza.sql:
// solo staff), senza i controlli delle RPC: per aprire, chiudere o spostare
// la scadenza preferire apriFase / chiudiFase / modificaScadenzaFase.
export async function aggiornaFase(faseId, modifiche) {
  return await supabase.from("fase").update(modifiche).eq("id", faseId).select().single();
}

// Aggiorna lo stato di una pratica.
// Scrittura diretta sulla tabella `pratica` (RLS pratica_write, 02_sicurezza.sql:
// solo staff). Per cambiare lo stato con motivazione usare cambiaStatoPratica.
export async function aggiornaPratica(id, modifiche) {
  return await supabase.from("pratica").update(modifiche).eq("id", id).select().single();
}

// ---- Documenti ----

// Elenca i documenti di una pratica.
// - faseId undefined: tutti i documenti della pratica
// - faseId = "<id>": solo i documenti di quella fase
// - faseId = null: solo i documenti generali (non legati a una fase)
// Tabella `documento` (01_schema.sql). RLS doc_select (02_sicurezza.sql):
// il cliente vede solo i documenti visibili_cliente o pubblici.
// Restituisce tutte le versioni, dalla più recente.
export async function elencaDocumenti(praticaId, faseId = undefined) {
  let q = supabase.from("documento").select("*").eq("pratica_id", praticaId);
  if (faseId === null) q = q.is("fase_id", null);
  else if (faseId !== undefined) q = q.eq("fase_id", faseId);
  return await q.order("creato_il", { ascending: false });
}

// Calcola l'hash SHA-256 di un file (integrità).
// Restituisce 64 caratteri esadecimali, oppure null se il browser non
// supporta crypto.subtle (es. pagina non in HTTPS): il caricamento prosegue.
// Nota: legge tutto il file in memoria (fino a 50 MB).
async function hashFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/* Carica un documento per una pratica.
   - mai sovrascrive: ogni caricamento è una nuova versione
   - file salvato in storage: documenti/<pratica_id>/<timestamp>-<nome>
   - numero di versione, "versione corrente" e audit sono gestiti dal
     database (script 07): qui si inserisce solo il nuovo record.
   Servizi: archivio Storage `documenti` (04_storage.sql; limiti di
   dimensione e tipo in 14_controlli_file.sql) e tabella `documento`
   (01_schema.sql; RLS doc_insert in 08_integrazioni_azioni.sql: il cliente
   carica solo su pratiche proprie e attive; trigger trg_documento_prima e
   trg_documento_dopo in 07, trg_documento_verifica_file in 14).
   Per il cliente il database forza la visibilità (mai "pubblico").
   Effetti: file nell'archivio, riga in `documento`, audit e notifiche dai trigger.
   Restituisce { data: riga documento, error }. */
export async function caricaDocumento({
  praticaId,
  faseId = null,
  file,
  tipologia = null,
  nomeLogico = null,
  visibileCliente = true,
  visibileFondazione = true,
  pubblico = false,
  utenteId = null,
}) {
  const nome = nomeLogico || file.name;

  // Dimensione, formato e contenuto reale del file (requisiti §13).
  const verifica = await verificaFile(file);
  if (!verifica.ok) return { data: null, error: { message: verifica.errore } };

  // Carica il file nello storage (percorso che inizia con l'id pratica).
  // La prima cartella DEVE essere l'id della pratica: le regole dell'archivio
  // (04_storage.sql) la usano per decidere chi può leggere e scrivere.
  // upsert: false = un file esistente non viene mai sovrascritto.
  // contentType = tipo canonico dell'estensione, atteso dal controllo del database (14).
  const storagePath = `${praticaId}/${Date.now()}-${verifica.nomeSicuro}`;
  const { error: errUpload } = await supabase.storage
    .from("documenti")
    .upload(storagePath, file, { upsert: false, contentType: verifica.mime });
  if (errUpload) return { data: null, error: { message: traduciErroreArchivio(errUpload) } };

  const hash = await hashFile(file);

  // Inserisce il record del documento.
  const { data, error } = await supabase
    .from("documento")
    .insert({
      pratica_id: praticaId,
      fase_id: faseId,
      tipologia,
      nome,
      visibile_cliente: visibileCliente,
      visibile_fondazione: visibileFondazione,
      pubblico,
      storage_path: storagePath,
      hash_file: hash,
      caricato_da: utenteId,
    })
    .select()
    .single();

  // Registrazione rifiutata: il file appena caricato non resta orfano
  // (riesce allo staff; per il Cliente l'archivio non consente cancellazioni).
  if (error) await supabase.storage.from("documenti").remove([storagePath]).catch(() => {});

  return { data, error: traduciErrore(error) };
}

// Messaggio comprensibile per i rifiuti delle regole di sicurezza.
// Parametro: errore di Supabase (o null). Restituisce lo stesso errore, con
// il messaggio in italiano quando si tratta di un rifiuto RLS.
function traduciErrore(error) {
  if (error && /row-level security/i.test(error.message || "")) {
    return { ...error, message: "operazione non consentita (la pratica potrebbe essere sospesa, annullata o chiusa)" };
  }
  return error;
}

// Ottiene un URL temporaneo per scaricare un documento.
// Archivio `documenti` (04_storage.sql, regola documenti_select rivista in 07).
// L'indirizzo firmato vale 60 secondi: non va salvato né condiviso.
export async function urlDocumento(storagePath) {
  return await supabase.storage.from("documenti").createSignedUrl(storagePath, 60);
}

// ---- Consultazione pubblica ----

// Colonne del commento leggibili dal portale: l'identità dell'autore
// resta nota solo alla piattaforma (requisiti, sezione 6).
// Non aggiungere qui colonne come nome o email dell'autore: per lo staff si
// leggono con autoriCommenti (RPC staff_autori_commenti).
const COLONNE_COMMENTO =
  "id, consultazione_id, pratica_id, testo, allegato_documento_id, stato, motivazione_moderazione, risposta_testo, creato_il, firma_pubblica, allegato_path, allegato_nome, email_verificata_il";

// Legge la consultazione (eventuale) di una pratica, con i suoi commenti.
// Prende la più recente. Tabelle `consultazione` e `commento` (01_schema.sql;
// colonne aggiuntive del commento in 17_pratiche.sql; RLS consult_select e
// commento_select in 02_sicurezza.sql). Restituisce { data: null } se non esiste.
// Gli errori di lettura non vengono propagati (si mostra "nessuna consultazione").
export async function leggiConsultazione(praticaId) {
  const { data: cons } = await supabase
    .from("consultazione")
    .select("*")
    .eq("pratica_id", praticaId)
    .order("creato_il", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cons) return { data: null, error: null };

  const { data: commenti } = await supabase
    .from("commento")
    .select(COLONNE_COMMENTO)
    .eq("consultazione_id", cons.id)
    .order("creato_il", { ascending: true });

  return { data: { ...cons, commenti: commenti || [] }, error: null };
}

// Apre la consultazione: pubblica una versione del documento per 30 giorni.
// Scrive una riga in `consultazione` (01_schema.sql; RLS consult_write in
// 02_sicurezza.sql: solo staff). La consultazione diventa visibile sulla
// pagina pubblica /consultazioni (Edge Function consultazione-pubblica).
// Date in ora italiana (oggiItalia, src/lib/date.js), come nel database
// (20_rinforzi_integrita.sql): aperta da oggi fino a oggi + 30 giorni
// compreso. I 30 giorni sono fissi nel codice, non letti da durata_fase.
export async function apriConsultazione({ praticaId, documentoId }) {
  const oggi = oggiItalia();
  return await supabase
    .from("consultazione")
    .insert({
      pratica_id: praticaId,
      documento_id: documentoId,
      data_apertura: oggi,
      data_chiusura: aggiungiGiorni(oggi, 30),
      attiva: true,
    })
    .select()
    .single();
}

// Chiude la consultazione (attiva = false): non accetta più osservazioni.
// Tabella `consultazione` (01_schema.sql), RLS consult_write: solo staff.
export async function chiudiConsultazione(id) {
  return await supabase.from("consultazione").update({ attiva: false }).eq("id", id);
}

// Modera un commento: pubblica / non pubblica (con motivazione).
// Parametri: id, stato ('pubblicato' | 'non_pubblicato'), motivazione.
// Tabella `commento` (01_schema.sql), RLS commento_update (02_sicurezza.sql): solo staff.
export async function moderaCommento(id, stato, motivazione = null) {
  return await supabase
    .from("commento")
    .update({ stato, motivazione_moderazione: motivazione })
    .eq("id", id);
}

// Il cliente risponde a un commento ammesso.
// RPC `rispondi_commento` (07_correzioni_sicurezza.sql): controlla che il
// commento sia della propria pratica e ammesso (pubblicato o già risposto:
// la risposta si può correggere); lo stato diventa 'risposto'.
export async function rispondiCommento(id, risposta) {
  return await supabase.rpc("rispondi_commento", {
    p_commento: id,
    p_risposta: risposta,
  });
}

// ---- Gestione utenti (Admin) ----

// Elenco utenti con email, ruolo, organizzazione (funzione lato database).
// RPC `admin_elenco_utenti` (05_gestione_utenti.sql, rivista in
// 06_utente_multi_org.sql): legge auth.users, che il browser non vede; solo Admin.
export async function elencaUtenti() {
  return await supabase.rpc("admin_elenco_utenti");
}

// Aggiorna ruolo e organizzazioni di un utente.
// - organizzazioniIds: elenco delle organizzazioni (comuni/aziende) associate;
//   la prima resta anche come "organizzazione principale" sul profilo.
// - per gli operatori le associazioni vengono azzerate.
// RPC `admin_aggiorna_utente_completo` (20_rinforzi_integrita.sql): ruolo e
// organizzazioni in un'unica operazione; i controlli sono quelli di
// admin_aggiorna_utente (19_correzioni_revisione_codice.sql: solo Admin,
// niente nomine di Admin, non su se stessi) e admin_imposta_organizzazioni.
export async function aggiornaUtente(utenteId, ruolo, organizzazioniIds = []) {
  return await supabase.rpc("admin_aggiorna_utente_completo", {
    p_utente: utenteId,
    p_ruolo: ruolo,
    p_organizzazioni: ruolo === "cliente" ? organizzazioniIds : [],
  });
}

// Crea un nuovo utente con password temporanea (via Edge Function).
// Edge Function `crea-utente` (supabase/functions/crea-utente): verifica che
// il chiamante sia Admin e crea l'account con la chiave service_role, che il
// browser non ha. Imposta anche tutte le organizzazioni del cliente; se un
// passo fallisce l'account non resta creato a metà.
// organizzazioniIds: elenco completo per i clienti (la prima è la principale).
export async function creaUtente({ email, password, ruolo, organizzazioniIds = [], nomeCompleto }) {
  return await supabase.functions.invoke("crea-utente", {
    body: {
      email,
      password,
      ruolo,
      organizzazione_id: organizzazioniIds[0] || null,
      organizzazioni: organizzazioniIds,
      nome_completo: nomeCompleto,
    },
  });
}

// L'Amministratore assegna una nuova password temporanea (Edge Function
// "reimposta-password"); l'utente dovrà cambiarla al primo accesso.
// La funzione imposta profilo.password_temporanea (15_password.sql) e
// scrive l'audit. Esclusi gli amministratori e sé stessi.
export async function reimpostaPassword(utenteId, password) {
  const { data, error } = await supabase.functions.invoke("reimposta-password", {
    body: { utente_id: utenteId, password },
  });
  if (error) {
    // Le risposte di errore della funzione portano il motivo nel corpo.
    let motivo = error.message;
    try {
      const corpo = await error.context?.json();
      if (corpo?.error) motivo = corpo.error;
    } catch {
      /* corpo non leggibile: resta il messaggio generico */
    }
    return { data: null, error: { message: motivo } };
  }
  if (data?.error) return { data: null, error: { message: data.error } };
  return { data, error: null };
}

// ---- Audit ----
// L'audit trail è scritto automaticamente dal database (trigger, script 07)
// per ogni operazione rilevante: il browser non lo scrive più.

// ---- Cruscotto del back-office (script 09) ----
// Una riga per pratica: fase corrente, scadenza, integrazioni, consultazione.
// RPC `staff_cruscotto` (09_cruscotto_pagamenti_notifiche.sql).
export async function leggiCruscotto() {
  return await supabase.rpc("staff_cruscotto");
}

// ---- Rapporti di Monitoraggio annuali ----
// Crea il Rapporto dell'anno successivo per un Progetto (max 10),
// con le sue fasi. Codice e organizzazione li assegna il database.
// Parametro: riga del progetto (serve id e organizzazione_id).
// Tabelle `pratica` e `fase` tramite creaPratica. Il trigger
// trg_rapporto_coerente (09_cruscotto_pagamenti_notifiche.sql) impone
// l'organizzazione del Progetto e la sequenza degli anni; il limite di 10
// lo garantisce anche il database (vincolo chk_anno_range e indice
// uq_rapporto_anno, 01_schema.sql). Il controllo qui serve solo a dare un
// messaggio chiaro.
export async function creaRapporto(progetto) {
  const { data: esistenti } = await elencaRapporti(progetto.id);
  const anno = (esistenti || []).reduce((m, r) => Math.max(m, r.anno_monitoraggio || 0), 0) + 1;
  if (anno > 10) {
    return { data: null, error: { message: "Il Progetto ha già 10 Rapporti di Monitoraggio" } };
  }
  return await creaPratica({
    tipo: "rapporto",
    organizzazione_id: progetto.organizzazione_id,
    progetto_padre_id: progetto.id,
    anno_monitoraggio: anno,
    titolo: `Rapporto di Monitoraggio anno ${anno}`,
    stato: "attiva",
  });
}

// ---- Pagamenti (registrazione manuale, requisiti §7) ----

// Voci di pagamento di una pratica, per scadenza (quelle senza scadenza in fondo).
// Tabella `pagamento` (01_schema.sql); RLS pagamento_select (17_pratiche.sql):
// staff e Comune della pratica in sola lettura.
export async function elencaPagamenti(praticaId) {
  return await supabase
    .from("pagamento")
    .select("*")
    .eq("pratica_id", praticaId)
    .order("scadenza", { ascending: true, nullsFirst: false });
}

// Crea (senza id) o aggiorna (con id) una voce di pagamento.
// Tabella `pagamento`; RLS pagamento_write (17_pratiche.sql): solo staff.
// Il trigger trg_pagamento_operatore (09) registra l'operatore, mette la data
// di oggi se la voce è pagata senza data e la azzera se non è pagata.
export async function salvaPagamento(pagamento) {
  const { id, ...campi } = pagamento;
  if (id) return await supabase.from("pagamento").update(campi).eq("id", id).select().single();
  return await supabase.from("pagamento").insert(campi).select().single();
}

// ---- Visibilità dei documenti (staff) ----

// Cambia i flag di visibilità (visibile_cliente, visibile_fondazione, pubblico)
// o la tipologia di un documento. Tabella `documento`; RLS doc_update
// (02_sicurezza.sql): solo staff. Il trigger trg_documento_solo_flag (09)
// impedisce di cambiare nome, file, hash o versione.
export async function aggiornaVisibilitaDocumento(id, flag) {
  return await supabase.from("documento").update(flag).eq("id", id);
}

// ---- "I tuoi documenti": documenti generali delle pratiche del Cliente ----

// Documenti non legati a una fase, con codice e titolo della pratica.
// Nessun filtro per organizzazione: lo applica la RLS (doc_select, 02_sicurezza.sql).
export async function elencaDocumentiOrganizzazione() {
  return await supabase
    .from("documento")
    .select("*, pratica:pratica_id (codice, titolo, tipo, organizzazione:organizzazione_id (denominazione))")
    .is("fase_id", null)
    .order("creato_il", { ascending: false });
}

// ---- Notifiche interne ----

// Le ultime 50 notifiche dell'utente collegato.
// Tabella `notifica` (09_cruscotto_pagamenti_notifiche.sql); RLS notifica_select:
// ciascuno vede solo le proprie. Le notifiche le crea il database (trigger).
export async function elencaNotifiche() {
  return await supabase
    .from("notifica")
    .select("*")
    .order("creato_il", { ascending: false })
    .limit(50);
}

// Segna come lette le notifiche indicate (array di id; vuoto = nessuna chiamata).
// Tabella `notifica`; il trigger trg_notifica_solo_letta (09) consente di
// modificare solo il campo "letta".
export async function segnaNotificheLette(ids) {
  if (!ids.length) return { data: null, error: null };
  return await supabase.from("notifica").update({ letta: true }).in("id", ids);
}

// ---- Audit (solo staff) ----

// Eventi di audit, dal più recente; facoltativo il filtro per pratica.
// Tabella `audit_event` (01_schema.sql); RLS audit_select in
// 07_correzioni_sicurezza.sql: solo staff; nessuno può scriverla o
// modificarla dal portale. Sola lettura.
export async function elencaAudit({ praticaId = null, limite = 200 } = {}) {
  let q = supabase
    .from("audit_event")
    .select("*")
    .order("avvenuto_il", { ascending: false })
    .limit(limite);
  if (praticaId) q = q.eq("pratica_id", praticaId);
  return await q;
}

// Attiva / disattiva un utente (solo admin, script 10).
// RPC `admin_imposta_attivo` (10_mfa_profilo.sql): aggiorna profilo.attivo;
// non si può disattivare sé stessi.
export async function impostaUtenteAttivo(utenteId, attivo) {
  return await supabase.rpc("admin_imposta_attivo", { p_utente: utenteId, p_attivo: attivo });
}

// ---- Durata delle fasi (script 13) ----

// Durata in giorni di ciascuna delle 7 fasi.
// Tabella `durata_fase` (13_durata_fasi.sql), lettura per chi ha l'accesso.
export async function elencaDurateFasi() {
  return await supabase.from("durata_fase").select("*").order("numero", { ascending: true });
}

// Solo Amministratori; motivazione obbligatoria (registrata nell'audit).
// RPC `admin_imposta_durata_fase` (13_durata_fasi.sql). Vale per le fasi
// aperte da quel momento; le scadenze già fissate non cambiano.
export async function impostaDurataFase(numero, giorni, motivazione) {
  return await supabase.rpc("admin_imposta_durata_fase", {
    p_numero: numero,
    p_giorni: giorni,
    p_motivazione: motivazione,
  });
}

// ---- Consultazione: errata corrige, autori, allegati (script 17) ----

// Errata corrige: se "riparte" i 30 giorni ripartono da oggi (motivazione obbligatoria).
// RPC `staff_errata_corrige` (17_pratiche.sql): solo staff, consultazione
// aperta, documento facoltativo della stessa pratica. Scrive in
// `consultazione_errata`, visibile sulla pagina pubblica.
export async function pubblicaErrataCorrige({ consultazioneId, documentoId = null, testo, riparte, motivazione = null }) {
  return await supabase.rpc("staff_errata_corrige", {
    p_consultazione: consultazioneId,
    p_documento: documentoId,
    p_testo: testo,
    p_riparte: !!riparte,
    p_motivazione: motivazione,
  });
}

// Errata corrige di una consultazione, in ordine di pubblicazione, con il
// documento collegato. Tabella `consultazione_errata` (17_pratiche.sql).
export async function elencaErrata(consultazioneId) {
  return await supabase
    .from("consultazione_errata")
    .select("*, documento:documento_id (id, nome, versione, storage_path)")
    .eq("consultazione_id", consultazioneId)
    .order("creato_il", { ascending: true });
}

// Nome ed email degli autori delle osservazioni (solo staff).
// RPC `staff_autori_commenti` (17_pratiche.sql). Dati personali: non vanno
// mai mostrati al Comune né sulla pagina pubblica.
export async function autoriCommenti(consultazioneId) {
  return await supabase.rpc("staff_autori_commenti", { p_consultazione: consultazioneId });
}

// URL temporaneo (60 secondi) per l'allegato di un'osservazione.
// Archivio `allegati-consultazione` (17_pratiche.sql; regola
// allegati_consultazione_select). Gli allegati li scrive solo la funzione
// consultazione-pubblica.
export async function urlAllegatoCommento(path) {
  return await supabase.storage.from("allegati-consultazione").createSignedUrl(path, 60);
}

// Pagina pubblica delle consultazioni (Edge Function, senza accesso).
// Parametri: azione ("elenco", "dettaglio", "invia", "conferma") e i dati
// richiesti dall'azione. Edge Function `consultazione-pubblica`
// (supabase/functions/consultazione-pubblica; Verify JWT disattivato).
// I messaggi d'errore arrivano nel campo "errore" del corpo della risposta.
export async function consultazionePubblica(azione, dati = {}) {
  const { data, error } = await supabase.functions.invoke("consultazione-pubblica", { body: { azione, ...dati } });
  if (error) {
    let motivo = "Servizio momentaneamente non disponibile. Riprova più tardi.";
    try {
      const corpo = await error.context?.json();
      if (corpo?.errore) motivo = corpo.errore;
    } catch {
      /* corpo non leggibile */
    }
    return { data: null, error: { message: motivo } };
  }
  if (data?.errore) return { data: null, error: { message: data.errore } };
  return { data, error: null };
}

// ---- Note di fase (script 17) ----

// Note di tutte le fasi di una pratica, in ordine cronologico.
// Tabella `nota_fase` (17_pratiche.sql); RLS nota_fase_select: il cliente
// vede solo le note con visibile_cliente.
export async function elencaNoteFase(praticaId) {
  return await supabase
    .from("nota_fase")
    .select("*")
    .eq("pratica_id", praticaId)
    .order("creato_il", { ascending: true });
}

// Aggiunge una nota a una fase (interna o condivisa con il Comune).
// Tabella `nota_fase`; RLS nota_fase_insert: solo staff. Autore compilato dal
// trigger trg_autore (17). Le note non si modificano né si cancellano.
export async function aggiungiNotaFase({ faseId, praticaId, testo, visibileCliente }) {
  return await supabase
    .from("nota_fase")
    .insert({ fase_id: faseId, pratica_id: praticaId, testo, visibile_cliente: !!visibileCliente })
    .select()
    .single();
}

// ---- Messaggi tra Comune e Fondazione (script 17) ----

// Messaggi di una pratica, in ordine cronologico.
// Tabella `messaggio` (17_pratiche.sql); RLS messaggio_select.
export async function elencaMessaggi(praticaId) {
  return await supabase
    .from("messaggio")
    .select("*")
    .eq("pratica_id", praticaId)
    .order("creato_il", { ascending: true });
}

// Invia un messaggio nella pratica. Tabella `messaggio`; RLS messaggio_insert
// (17_pratiche.sql): staff, o cliente su pratica propria non annullata.
// Autore e ruolo li compila il trigger trg_autore; notifica dai trigger.
export async function inviaMessaggio(praticaId, testo) {
  return await supabase.from("messaggio").insert({ pratica_id: praticaId, testo }).select().single();
}

// ---- Enti di Validazione (script 17) ----

// Anagrafica degli Enti di Validazione in ordine alfabetico.
// Tabella `ente_validazione` (01_schema.sql, colonne aggiunte in 17_pratiche.sql);
// RLS ente_select (17): lettura per chi ha l'accesso.
export async function elencaEnti() {
  return await supabase.from("ente_validazione").select("*").order("denominazione", { ascending: true });
}

// Crea (senza id) o aggiorna (con id) un Ente di Validazione.
// Tabella `ente_validazione`; RLS ente_write (17_pratiche.sql): solo Admin.
export async function salvaEnte(ente) {
  const { id, ...campi } = ente;
  campi.aggiornato_il = new Date().toISOString();
  if (id) return await supabase.from("ente_validazione").update(campi).eq("id", id).select().single();
  return await supabase.from("ente_validazione").insert(campi).select().single();
}

// Assegna (o toglie, con enteId vuoto) l'Ente di Validazione a una pratica.
// RPC `staff_imposta_ente_validazione` (17_pratiche.sql): Operatore o Admin.
export async function impostaEntePratica(praticaId, enteId) {
  return await supabase.rpc("staff_imposta_ente_validazione", { p_pratica: praticaId, p_ente: enteId || null });
}

// ---- Modelli di documento (script 17) ----

// Modelli di documento, ordinati per fase (prima quelli generali) e titolo.
// tutti = true include i modelli disattivati (pagina Impostazioni, solo Admin).
// Tabella `modello_documento` (17_pratiche.sql); RLS modello_select: gli
// altri utenti vedono comunque solo i modelli attivi.
export async function elencaModelli({ tutti = false } = {}) {
  let q = supabase.from("modello_documento").select("*");
  if (!tutti) q = q.eq("attivo", true);
  return await q.order("fase_numero", { ascending: true, nullsFirst: true }).order("titolo", { ascending: true });
}

// Carica un nuovo modello di documento (solo Admin).
// Archivio `modelli` e tabella `modello_documento` (17_pratiche.sql; regole
// modelli_insert e modello_write: solo Admin). Stessi controlli sui file dei
// documenti (file.js). Se la registrazione fallisce il file viene rimosso.
export async function caricaModello({ file, titolo, descrizione = null, faseNumero = null }) {
  const verifica = await verificaFile(file);
  if (!verifica.ok) return { data: null, error: { message: verifica.errore } };
  // Cartella casuale: due modelli con lo stesso nome file non si scontrano.
  const storagePath = `${crypto.randomUUID()}/${verifica.nomeSicuro}`;
  const { error: errUpload } = await supabase.storage
    .from("modelli")
    .upload(storagePath, file, { upsert: false, contentType: verifica.mime });
  if (errUpload) return { data: null, error: { message: traduciErroreArchivio(errUpload) } };
  const { data, error } = await supabase
    .from("modello_documento")
    .insert({
      titolo,
      descrizione,
      fase_numero: faseNumero || null,
      storage_path: storagePath,
      nome_file: file.name,
      dimensione: file.size,
      tipo_mime: verifica.mime,
    })
    .select()
    .single();
  if (error) await supabase.storage.from("modelli").remove([storagePath]).catch(() => {});
  return { data, error };
}

// Aggiorna i campi di un modello (titolo, descrizione, fase, attivo).
// Tabella `modello_documento`; RLS modello_write (17_pratiche.sql): solo Admin.
export async function aggiornaModello(id, campi) {
  return await supabase.from("modello_documento").update(campi).eq("id", id);
}

// URL temporaneo (60 secondi) per scaricare un modello; download: true fa
// salvare il file invece di aprirlo. Archivio `modelli` (17_pratiche.sql).
export async function urlModello(path) {
  return await supabase.storage.from("modelli").createSignedUrl(path, 60, { download: true });
}

// Nome di un utente (per i rapporti: chi ha confermato un calcolo). Solo Admin.
// Tabella `profilo` (01_schema.sql). Restituisce il nome oppure null
// (anche quando la RLS non consente di leggere quel profilo).
export async function nomeUtente(id) {
  if (!id) return null;
  const { data } = await supabase.from("profilo").select("nome_completo").eq("id", id).maybeSingle();
  return data?.nome_completo || null;
}
