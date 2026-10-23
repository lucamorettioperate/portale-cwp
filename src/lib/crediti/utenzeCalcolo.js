/* =========================================================================
   utenzeCalcolo.js — lettura e scrittura della Banca Dati Utenze di un
   calcolo (una riga per utenza, tabella calcolo_utenza dello script 40).
   Richieste di Luca Moretti del 22/10/2026.

   Scopo: elenco a pagine con ricerca, conteggi, modulo di una singola
   utenza (nuova o modificata), cancellazione e caricamento dell'elenco
   completo dell'anno (sostituisce quello precedente).
   Usato da: src/components/crediti/UtenzeCalcolo.jsx e, per il motore
   (leggiUtenzeCalcolo), src/pages/CalcoloCrediti.jsx.

   Sicurezza (garantita dal database, script 40):
   - la tabella non si legge direttamente: elenco con staff_elenco_utenze
     (Operatori e Amministratori), che registra la consultazione nell'audit;
   - scrittura solo dell'Amministratore: admin_salva_utenza,
     admin_elimina_utenza, admin_svuota_utenze e inserimento a blocchi
     (policy utenza_inserimento), una voce di audit per blocco;
   - un calcolo confermato non cambia più le sue utenze.
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti».
   ========================================================================= */
import { supabase } from "../supabase.js";

// Utenze per blocco di inserimento: righe di circa 0,5 KB, quindi richieste
// di circa 250 KB.
const BLOCCO_INSERIMENTO = 500;

// Numero di utenze per tipo: { UD: { utenze, senzaCategoria }, UnD: {…} }.
export async function contaUtenze(calcoloId) {
  const { data, error } = await supabase.rpc("admin_conta_utenze", { p_calcolo: calcoloId });
  const out = { UD: { utenze: 0, senzaCategoria: 0 }, UnD: { utenze: 0, senzaCategoria: 0 } };
  (data || []).forEach((r) => { out[r.tipo] = { utenze: Number(r.utenze), senzaCategoria: Number(r.senza_categoria) }; });
  return { data: out, error };
}

// Una pagina dell'elenco. Parametri: id del calcolo; { cerca (codice,
// nominativo, indirizzo o categoria esatta), tipo "UD" | "UnD", da (primo
// indice), quanti }. Restituisce { data: righe, totale, error }.
export async function elencaUtenze(calcoloId, { cerca = "", tipo = null, da = 0, quanti = 50 } = {}) {
  const { data, error } = await supabase.rpc("staff_elenco_utenze", {
    p_calcolo: calcoloId, p_cerca: cerca || null, p_tipo: tipo, p_da: da, p_quanti: quanti,
  });
  return { data: data || [], totale: data?.length ? Number(data[0].totale) : 0, error };
}

// Salva un'utenza dal modulo: id null = nuova. Restituisce { data: id, error }.
export async function salvaUtenza(calcoloId, id, utenza) {
  return await supabase.rpc("admin_salva_utenza", { p_calcolo: calcoloId, p_id: id ?? null, p_utenza: utenza });
}

export async function eliminaUtenza(id) {
  return await supabase.rpc("admin_elimina_utenza", { p_id: id });
}

// Toglie tutte le utenze del calcolo (motivazione facoltativa, nell'audit).
export async function svuotaUtenze(calcoloId, motivazione = null) {
  return await supabase.rpc("admin_svuota_utenze", { p_calcolo: calcoloId, p_motivazione: motivazione });
}

// Sostituisce l'elenco completo: toglie quello precedente e inserisce le
// nuove utenze a blocchi. onAvanzamento(inserite, totale) per la barra.
// Se un blocco fallisce si ferma e lo dice: l'elenco resta parziale e va
// ricaricato (il calcolo non si conferma con un elenco diverso da quello
// usato, controllo dello script 20).
export async function sostituisciUtenze(calcoloId, utenze, onAvanzamento) {
  const s = await svuotaUtenze(calcoloId, "nuovo caricamento dell'elenco completo");
  if (s.error) return { error: s.error };
  for (let i = 0; i < utenze.length; i += BLOCCO_INSERIMENTO) {
    const blocco = utenze.slice(i, i + BLOCCO_INSERIMENTO).map((u) => ({ ...u, calcolo_id: calcoloId }));
    const { error } = await supabase.from("calcolo_utenza").insert(blocco);
    if (error) {
      return { error: { message: `Caricamento interrotto dopo ${i} utenze su ${utenze.length}: ${error.message}. Ricaricate il file.` } };
    }
    onAvanzamento && onAvanzamento(Math.min(i + BLOCCO_INSERIMENTO, utenze.length), utenze.length);
  }
  return { error: null };
}

// Tutte le utenze del calcolo per il motore, SENZA nomi e indirizzi
// (admin_utenze_calcolo, solo Amministratore, nessuna voce di audit), a
// blocchi di 5.000. Restituisce { data: righe, error }. Aggiunta il
// 23/10/2026: il motore usa le utenze del passo 5a.
const BLOCCO_LETTURA = 5000;
export async function leggiUtenzeCalcolo(calcoloId) {
  const tutte = [];
  for (let da = 0; ; da += BLOCCO_LETTURA) {
    const { data, error } = await supabase.rpc("admin_utenze_calcolo", { p_calcolo: calcoloId, p_da: da, p_quanti: BLOCCO_LETTURA });
    if (error) return { data: tutte, error };
    tutte.push(...(data || []));
    if (!data || data.length < BLOCCO_LETTURA) return { data: tutte, error: null };
  }
}
