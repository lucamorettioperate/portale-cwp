/* =========================================================================
   Strato di accesso ai dati — legge e scrive su Supabase.
   Tutte le funzioni restituiscono { data, error } come il client Supabase.
   ========================================================================= */
import { supabase } from "./supabase.js";
import { FASI } from "./cwpProgram.js";

// ---- Organizzazioni ----
export async function elencaOrganizzazioni() {
  return await supabase
    .from("organizzazione")
    .select("*")
    .order("denominazione", { ascending: true });
}

export async function creaOrganizzazione(dati) {
  return await supabase.from("organizzazione").insert(dati).select().single();
}

// ---- Pratiche (Progetti e Rapporti) ----

// Elenca i progetti (pratiche di tipo 'progetto') con la loro organizzazione.
export async function elencaProgetti() {
  return await supabase
    .from("pratica")
    .select("*, organizzazione:organizzazione_id (denominazione, tipo)")
    .eq("tipo", "progetto")
    .order("creato_il", { ascending: false });
}

// Elenca i rapporti di un progetto.
export async function elencaRapporti(progettoId) {
  return await supabase
    .from("pratica")
    .select("*")
    .eq("tipo", "rapporto")
    .eq("progetto_padre_id", progettoId)
    .order("anno_monitoraggio", { ascending: true });
}

// Legge una singola pratica con organizzazione e fasi.
export async function leggiPratica(id) {
  return await supabase
    .from("pratica")
    .select("*, organizzazione:organizzazione_id (denominazione, tipo), fasi:fase (*)")
    .eq("id", id)
    .single();
}

// Crea una pratica e genera automaticamente le sue 7 fasi.
export async function creaPratica(dati) {
  const { data: pratica, error } = await supabase
    .from("pratica")
    .insert(dati)
    .select()
    .single();
  if (error) return { data: null, error };

  // Genera le 7 fasi standard.
  const fasi = FASI.map((f) => ({
    pratica_id: pratica.id,
    numero: f.numero,
    nome: f.nome,
    responsabile: f.responsabile,
    stato: f.numero === 1 ? "in_corso" : "non_iniziata",
  }));
  const { error: errFasi } = await supabase.from("fase").insert(fasi);
  if (errFasi) return { data: pratica, error: errFasi };

  return { data: pratica, error: null };
}

// Aggiorna lo stato di una fase (es. apertura/chiusura).
export async function aggiornaFase(faseId, modifiche) {
  return await supabase.from("fase").update(modifiche).eq("id", faseId).select().single();
}

// Aggiorna lo stato di una pratica.
export async function aggiornaPratica(id, modifiche) {
  return await supabase.from("pratica").update(modifiche).eq("id", id).select().single();
}

// ---- Documenti ----

// Elenca i documenti di una pratica.
// - faseId undefined: tutti i documenti della pratica
// - faseId = "<id>": solo i documenti di quella fase
// - faseId = null: solo i documenti generali (non legati a una fase)
export async function elencaDocumenti(praticaId, faseId = undefined) {
  let q = supabase.from("documento").select("*").eq("pratica_id", praticaId);
  if (faseId === null) q = q.is("fase_id", null);
  else if (faseId !== undefined) q = q.eq("fase_id", faseId);
  return await q.order("creato_il", { ascending: false });
}

// Calcola l'hash SHA-256 di un file (integrità).
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
   - se è una nuova versione dello stesso "nome logico", la precedente
     viene marcata non-corrente. */
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

  // Versione successiva per lo stesso nome logico nella pratica.
  const { data: esistenti } = await supabase
    .from("documento")
    .select("id, versione")
    .eq("pratica_id", praticaId)
    .eq("nome", nome)
    .order("versione", { ascending: false })
    .limit(1);
  const versione = esistenti && esistenti.length ? esistenti[0].versione + 1 : 1;

  // Carica il file nello storage (percorso che inizia con l'id pratica).
  const storagePath = `${praticaId}/${Date.now()}-${file.name}`;
  const { error: errUpload } = await supabase.storage
    .from("documenti")
    .upload(storagePath, file, { upsert: false });
  if (errUpload) return { data: null, error: errUpload };

  const hash = await hashFile(file);

  // Marca non-corrente la versione precedente.
  if (versione > 1) {
    await supabase
      .from("documento")
      .update({ corrente: false })
      .eq("pratica_id", praticaId)
      .eq("nome", nome);
  }

  // Inserisce il record del documento.
  const { data, error } = await supabase
    .from("documento")
    .insert({
      pratica_id: praticaId,
      fase_id: faseId,
      tipologia,
      nome,
      versione,
      corrente: true,
      visibile_cliente: visibileCliente,
      visibile_fondazione: visibileFondazione,
      pubblico,
      stato: "corrente",
      storage_path: storagePath,
      hash_file: hash,
      caricato_da: utenteId,
    })
    .select()
    .single();

  return { data, error };
}

// Ottiene un URL temporaneo per scaricare un documento.
export async function urlDocumento(storagePath) {
  return await supabase.storage.from("documenti").createSignedUrl(storagePath, 60);
}

// ---- Consultazione pubblica ----

// Legge la consultazione (eventuale) di una pratica, con i suoi commenti.
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
    .select("*")
    .eq("consultazione_id", cons.id)
    .order("creato_il", { ascending: true });

  return { data: { ...cons, commenti: commenti || [] }, error: null };
}

// Apre la consultazione: pubblica una versione del documento per 30 giorni.
export async function apriConsultazione({ praticaId, documentoId }) {
  const oggi = new Date();
  const chiusura = new Date(oggi.getTime() + 30 * 24 * 60 * 60 * 1000);
  return await supabase
    .from("consultazione")
    .insert({
      pratica_id: praticaId,
      documento_id: documentoId,
      data_apertura: oggi.toISOString().slice(0, 10),
      data_chiusura: chiusura.toISOString().slice(0, 10),
      attiva: true,
    })
    .select()
    .single();
}

// Chiude la consultazione.
export async function chiudiConsultazione(id) {
  return await supabase.from("consultazione").update({ attiva: false }).eq("id", id);
}

// Invia un commento (identità nota, pubblicato in forma anonima).
export async function inviaCommento({ consultazioneId, praticaId, testo, autoreUtenteId }) {
  return await supabase
    .from("commento")
    .insert({
      consultazione_id: consultazioneId,
      pratica_id: praticaId,
      testo,
      autore_utente_id: autoreUtenteId,
      stato: "ricevuto",
    })
    .select()
    .single();
}

// Modera un commento: pubblica / non pubblica (con motivazione).
export async function moderaCommento(id, stato, motivazione = null) {
  return await supabase
    .from("commento")
    .update({ stato, motivazione_moderazione: motivazione })
    .eq("id", id);
}

// Il cliente risponde a un commento ammesso.
export async function rispondiCommento(id, risposta) {
  return await supabase
    .from("commento")
    .update({ risposta_testo: risposta, stato: "risposto" })
    .eq("id", id);
}

// ---- Gestione utenti (Admin) ----

// Elenco utenti con email, ruolo, organizzazione (funzione lato database).
export async function elencaUtenti() {
  return await supabase.rpc("admin_elenco_utenti");
}

// Aggiorna ruolo e organizzazioni di un utente.
// - organizzazioniIds: elenco delle organizzazioni (comuni/aziende) associate;
//   la prima resta anche come "organizzazione principale" sul profilo.
// - per gli operatori le associazioni vengono azzerate.
export async function aggiornaUtente(utenteId, ruolo, organizzazioniIds = []) {
  const ids = ruolo === "cliente" ? organizzazioniIds : [];
  const r1 = await supabase.rpc("admin_aggiorna_utente", {
    p_utente: utenteId,
    p_ruolo: ruolo,
    p_organizzazione: ids[0] || null,
  });
  if (r1.error) return r1;
  return await impostaOrganizzazioniUtente(utenteId, ids);
}

// Imposta l'elenco completo delle organizzazioni associate a un utente.
export async function impostaOrganizzazioniUtente(utenteId, organizzazioniIds) {
  return await supabase.rpc("admin_imposta_organizzazioni", {
    p_utente: utenteId,
    p_organizzazioni: organizzazioniIds,
  });
}

// Crea un nuovo utente con password temporanea (via Edge Function).
export async function creaUtente({ email, password, ruolo, organizzazioneId, nomeCompleto }) {
  return await supabase.functions.invoke("crea-utente", {
    body: {
      email,
      password,
      ruolo,
      organizzazione_id: organizzazioneId,
      nome_completo: nomeCompleto,
    },
  });
}

// ---- Audit ----
export async function registraAudit(evento) {
  return await supabase.from("audit_event").insert(evento);
}
