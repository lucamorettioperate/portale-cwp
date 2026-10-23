/* =========================================================================
   scenari.js — accesso ai dati degli scenari del simulatore.

   Scopo: unico punto in cui il portale legge e scrive la tabella
   scenario_simulazione (supabase/28_simulatore.sql).
   Usato da: src/pages/Simulatore.jsx.
   Sicurezza: la tabella è leggibile e scrivibile solo dallo staff
   (Operatori e Amministratori, policy scenario_staff); ogni creazione,
   modifica e cancellazione finisce nell'audit (trigger audit_registra).
   Ogni funzione restituisce { data, error } come supabase-js.
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti», backlog 37.
   ========================================================================= */
import { supabase } from "../supabase.js";
import { erroriScenario } from "./simulatore.js";

// Secondo strato del controllo dei dati (collaudo V01, D01/D02/D03): anche
// se la pagina lasciasse passare un dato impossibile, qui non si scrive.
// Il terzo strato è nel database (script 35). Restituisce { error } o null.
function rifiutaSeNonAmmessi(dati) {
  if (!dati) return null;
  const errori = erroriScenario(dati);
  if (!errori.length) return null;
  return { data: null, error: { message: `Scenario non salvato, dati non ammessi: ${errori.slice(0, 3).join(" ")}${errori.length > 3 ? " …" : ""}` } };
}

const CAMPI_ELENCO = "id, organizzazione_id, comune, nome, durata, anno_inizio, crediti_netti_totali, rd_finale, simulato_il, aggiornato_il";

// Tutti gli scenari, dal più recente, senza i dati di dettaglio.
export async function elencaScenari() {
  return await supabase.from("scenario_simulazione").select(CAMPI_ELENCO).order("aggiornato_il", { ascending: false });
}

// Uno scenario completo (con i dati di input).
export async function leggiScenario(id) {
  return await supabase.from("scenario_simulazione").select("*").eq("id", id).single();
}

// Nuovo scenario. Parametri: comune (testo), organizzazioneId (facoltativo),
// nome, durata (7, 10 o 21), annoInizio, dati iniziali.
export async function creaScenario({ comune, organizzazioneId = null, nome, durata, annoInizio, note = null, dati }) {
  const rifiuto = rifiutaSeNonAmmessi(dati);
  if (rifiuto) return rifiuto;
  return await supabase
    .from("scenario_simulazione")
    .insert({ comune, organizzazione_id: organizzazioneId, nome, durata, anno_inizio: annoInizio, note, dati })
    .select()
    .single();
}

// Salva input e riepilogo dei risultati. Parametro: id e campi da
// aggiornare (nome, note, durata, anno_inizio, dati, crediti_netti_totali,
// rd_finale, ricavi_totali (dal 23/10/2026, script 42), simulato_il).
export async function salvaScenario(id, campi) {
  const rifiuto = rifiutaSeNonAmmessi(campi.dati);
  if (rifiuto) return rifiuto;
  return await supabase.from("scenario_simulazione").update(campi).eq("id", id).select().single();
}

// Copia di uno scenario con un nuovo nome (per confrontare varianti).
export async function duplicaScenario(scenario, nome) {
  return await creaScenario({
    comune: scenario.comune,
    organizzazioneId: scenario.organizzazione_id,
    nome,
    durata: scenario.durata,
    annoInizio: scenario.anno_inizio,
    note: scenario.note,
    dati: scenario.dati,
  });
}

// Cancella uno scenario (resta traccia nell'audit).
export async function eliminaScenario(id) {
  return await supabase.from("scenario_simulazione").delete().eq("id", id);
}
