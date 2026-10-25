/* =========================================================================
   marketingDati.js — accesso ai dati dello strumento di marketing
   (tabelle mkt_* dello script 44, funzione del server «marketing»).
   Richiesta di Luca Moretti del 23/10/2026.

   Tutte le tabelle sono solo per gli Amministratori (RLS app_is_admin): le
   funzioni qui restituiscono { data, error } come il client Supabase.
   Usato da: src/pages/Marketing.jsx e componenti in src/components/marketing/;
   la landing page pubblica (src/pages/Scopri.jsx) usa solo azionePubblica.
   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import { supabase } from "./supabase.js";

const PER_PAGINA = 50;

// Applica i filtri dell'elenco a una lettura di mkt_ente. Filtri: tipo,
// regioni [], province [], cerca (denominazione o comune), popMin,
// popMax, conEmail, natura, raccolta, tariffa.
function filtra(q, f = {}) {
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.regioni?.length) q = q.in("regione", f.regioni);
  if (f.province?.length) q = q.in("sigla", f.province);
  if (f.cerca?.trim()) {
    const s = f.cerca.trim().replace(/[%,()]/g, " ");
    q = q.or(`denominazione.ilike.%${s}%,comune_sede.ilike.%${s}%,codice_fiscale.ilike.%${s}%`);
  }
  if (f.popMin !== "" && f.popMin != null) q = q.gte("popolazione", Number(f.popMin));
  if (f.popMax !== "" && f.popMax != null) q = q.lte("popolazione", Number(f.popMax));
  if (f.conEmail) q = q.not("email", "is", null);
  if (f.natura) q = q.eq("natura", f.natura);
  if (f.raccolta) q = q.eq("attivita_raccolta", true);
  if (f.tariffa) q = q.eq("attivita_tariffa", true);
  return q;
}

// Una pagina dell'elenco con il totale. pagina parte da 0.
export async function elencaEnti(filtri, pagina = 0, ordine = "denominazione") {
  const da = pagina * PER_PAGINA;
  const q = filtra(supabase.from("mkt_ente").select("id, tipo, denominazione, regione, sigla, comune_sede, popolazione, pec, email, sito, albo_categorie, natura, attivita_raccolta, attivita_tariffa, referenti:mkt_referente(count)", { count: "exact" }), filtri)
    .order(ordine).order("id").range(da, da + PER_PAGINA - 1);
  const { data, error, count } = await q;
  return { data: data || [], totale: count || 0, error, perPagina: PER_PAGINA };
}

// Id e email di TUTTI gli enti che rispettano i filtri (per una campagna),
// a blocchi di 1.000.
export async function idEntiFiltrati(filtri) {
  const out = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await filtra(supabase.from("mkt_ente").select("id, email"), filtri).order("id").range(da, da + 999);
    if (error) return { data: out, error };
    out.push(...(data || []));
    if (!data || data.length < 1000) return { data: out, error: null };
  }
}

export async function leggiEnte(id) {
  return await supabase.from("mkt_ente").select("*, referenti:mkt_referente(*)").eq("id", id).single();
}

// Salva i campi modificabili di un ente.
export async function salvaEnte(id, campi) {
  return await supabase.from("mkt_ente").update(campi).eq("id", id);
}

// Referente: nuovo (senza id) o modifica; cancellazione.
export async function salvaReferente(r) {
  const { id, ...campi } = r;
  if (id) return await supabase.from("mkt_referente").update({ ...campi, aggiornato_il: new Date().toISOString() }).eq("id", id);
  return await supabase.from("mkt_referente").insert({ ...campi, chiave: `manuale-${Date.now()}`, fonte: campi.fonte || "inserito a mano" });
}
export async function eliminaReferente(id) {
  return await supabase.from("mkt_referente").delete().eq("id", id);
}

// Regioni e province presenti (per i filtri), dal riepilogo.
export async function riepilogoMarketing() {
  return await supabase.rpc("admin_mkt_riepilogo");
}
export async function provinceDi(regioni) {
  const { data, error } = await supabase.from("mkt_ente").select("sigla, provincia").in("regione", regioni).not("sigla", "is", null).limit(1000);
  const m = new Map();
  (data || []).forEach((r) => m.set(r.sigla, r.provincia || r.sigla));
  return { data: [...m].map(([sigla, nome]) => ({ sigla, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "it")), error };
}

// ---- Campagne ----
export async function elencaCampagne() {
  return await supabase.from("mkt_campagna").select("*").order("creato_il", { ascending: false });
}
export async function leggiCampagna(id) {
  return await supabase.from("mkt_campagna").select("*").eq("id", id).single();
}
export async function salvaCampagna(c) {
  const { id, ...campi } = c;
  if (id) return await supabase.from("mkt_campagna").update(campi).eq("id", id).select().single();
  return await supabase.from("mkt_campagna").insert(campi).select().single();
}
export async function eliminaCampagna(id) {
  return await supabase.from("mkt_campagna").delete().eq("id", id);
}
// Numeri degli invii di una campagna per stato e risposte.
export async function statoInvii(campagnaId) {
  const conta = async (filtro) => {
    let q = supabase.from("mkt_invio").select("id", { count: "exact", head: true }).eq("campagna_id", campagnaId);
    q = filtro(q);
    const { count } = await q;
    return count || 0;
  };
  const [totale, daInviare, inviati, errori, esclusi, visite, simulazioni, richieste] = await Promise.all([
    conta((q) => q),
    conta((q) => q.eq("stato", "da_inviare")),
    conta((q) => q.eq("stato", "inviato")),
    conta((q) => q.eq("stato", "errore")),
    conta((q) => q.eq("stato", "escluso")),
    conta((q) => q.not("visitato_il", "is", null)),
    conta((q) => q.not("simulato_il", "is", null)),
    conta((q) => q.not("richiesta_il", "is", null)),
  ]);
  return { totale, daInviare, inviati, errori, esclusi, visite, simulazioni, richieste };
}
export async function ultimiErrori(campagnaId) {
  return await supabase.from("mkt_invio").select("email, errore").eq("campagna_id", campagnaId).eq("stato", "errore").limit(5);
}
export async function preparaInvii(campagnaId, idEnti) {
  return await supabase.rpc("admin_mkt_prepara_invii", { p_campagna: campagnaId, p_enti: idEnti });
}
export async function togliInviiDaInviare(campagnaId) {
  return await supabase.from("mkt_invio").delete().eq("campagna_id", campagnaId).eq("stato", "da_inviare");
}

// ---- Richieste di registrazione ----
export async function elencaRichieste() {
  return await supabase.from("mkt_richiesta").select("*, ente_rif:ente_id (denominazione, regione, sigla)").order("creato_il", { ascending: false }).limit(500);
}
export async function aggiornaRichiesta(id, campi) {
  return await supabase.from("mkt_richiesta").update(campi).eq("id", id);
}

// ---- Funzione del server ----
// Azioni degli Amministratori (importazioni, prova, invio): il client
// manda il token della sessione. Restituisce { data, error }.
export async function azioneMarketing(azione, parametri = {}) {
  const { data, error } = await supabase.functions.invoke("marketing", { body: { azione, ...parametri } });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.errore) msg = j.errore; } catch { /* risposta non JSON */ }
    return { data: null, error: { message: msg } };
  }
  if (data?.errore) return { data: null, error: { message: data.errore } };
  return { data, error: null };
}
// Azioni pubbliche della landing page (visita, simulata, richiesta,
// disiscrivi): stessa funzione, senza accesso.
export const azionePubblica = azioneMarketing;

// ---- Lettura dei siti (script 46) ----
// Riepilogo: { attiva, per_stato: { "comune:fatto": n, … }, token_in,
// token_out, ultima, ultimi_errori: [{ denominazione, errore }] }.
export async function riepilogoLettura() {
  return await supabase.rpc("admin_mkt_lettura_riepilogo");
}
// Mette in coda gli enti con sito (tipo "comune", "gestore" o null = tutti);
// ripeti = true rimette in coda anche quelli già letti o in errore.
export async function accodaLettura(tipo, ripeti = false) {
  return await supabase.rpc("admin_mkt_lettura_accoda", { p_tipo: tipo, p_ripeti: ripeti });
}
// Accende o spegne la lettura automatica (ogni 30 secondi, 4 enti alla volta).
export async function attivaLettura(attiva) {
  return await supabase.rpc("admin_mkt_lettura_attiva", { p_attiva: attiva });
}
