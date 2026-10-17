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

// ---- Audit ----
export async function registraAudit(evento) {
  return await supabase.from("audit_event").insert(evento);
}
