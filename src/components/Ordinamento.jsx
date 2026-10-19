/* =========================================================================
   Ordinamento — ordinare tabelle ed elenchi per qualsiasi colonna
   Scopo: richiesta di Luca del 19/10/2026: ogni informazione tabellare del
     portale si deve poter ordinare per ciascun campo. Tre elementi:
     - useOrdinamento(righe, colonne, iniziale): restituisce le righe
       ordinate e lo stato (colonna e verso) con la funzione cambia(chiave);
     - <ThOrdinabile>: intestazione di colonna cliccabile (primo clic
       crescente, secondo decrescente, poi di nuovo crescente), con freccia
       e aria-sort per i lettori di schermo;
     - <SceltaOrdinamento>: per gli elenchi a schede (pratiche, utenti,
       anagrafiche…): menu «Ordina per» e pulsante del verso.
   Regole di confronto (confronta e ordina in src/lib/ordinamento.js,
     provate in test/ordinamento.test.mjs): numeri come numeri, date ISO e testi in
     ordine alfabetico italiano (senza distinguere maiuscole, «CWP-2» prima
     di «CWP-10»), valori vuoti sempre in fondo; a parità resta l'ordine
     di partenza.
   Usato da: Dashboard (Cruscotto), Pratiche (BackOffice), Utenti, Audit,
     Anagrafiche, Reclami, Calcolo crediti, Registro crediti, Crediti
     emessi, Simulatore, Area Cliente e I tuoi documenti.
   Solo interfaccia: nessun dato letto o scritto.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";

import { confronta, ordina } from "../lib/ordinamento.js";

export { confronta, ordina };

/* Hook. Parametri: righe, colonne ({ chiave: funzione }), iniziale
   ({ chiave, verso } facoltativo). Restituisce { ordinate, chiave, verso,
   cambia(chiave), imposta(chiave, verso) }. */
export function useOrdinamento(righe, colonne, iniziale = {}) {
  const [ordine, setOrdine] = useState({ chiave: iniziale.chiave || null, verso: iniziale.verso || "asc" });
  // Ricalcolato a ogni visualizzazione: le funzioni delle colonne possono
  // dipendere da altri dati della pagina (es. le fasi lette dopo). Gli
  // elenchi del portale sono piccoli, il costo è trascurabile.
  const ordinate = ordina(righe || [], colonne, ordine);
  const cambia = (chiave) =>
    setOrdine((o) => (o.chiave === chiave ? { chiave, verso: o.verso === "asc" ? "desc" : "asc" } : { chiave, verso: "asc" }));
  const imposta = (chiave, verso) => setOrdine({ chiave: chiave || null, verso: verso || "asc" });
  return { ordinate, chiave: ordine.chiave, verso: ordine.verso, cambia, imposta };
}

/* Intestazione di colonna ordinabile. Props: ord (risultato di
   useOrdinamento), chiave, style (stile della cella), title, children
   (etichetta). Il clic non arriva alla riga sottostante. */
export function ThOrdinabile({ ord, chiave, style, title, children }) {
  const attiva = ord.chiave === chiave;
  const destra = style?.textAlign === "right";
  return (
    <th style={style} aria-sort={attiva ? (ord.verso === "asc" ? "ascending" : "descending") : "none"} title={title}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); ord.cambia(chiave); }}
        title={`Ordina per ${typeof children === "string" ? children.toLowerCase() : "questa colonna"}`}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          flexDirection: destra ? "row-reverse" : "row",
          color: attiva ? C.green : "inherit",
          font: "inherit",
          textTransform: "inherit",
          letterSpacing: "inherit",
        }}
      >
        <span>{children}</span>
        <span aria-hidden="true" style={{ fontSize: "0.85em", opacity: attiva ? 1 : 0.35 }}>
          {attiva ? (ord.verso === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

/* Ordinamento per gli elenchi a schede. Props: ord (useOrdinamento),
   opzioni ([[chiave, etichetta], …]), style (contenitore). La prima voce
   «ordine predefinito» lascia l'elenco com'è. */
export function SceltaOrdinamento({ ord, opzioni, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.grafite, ...style }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        Ordina per
        <select
          value={ord.chiave || ""}
          onChange={(e) => ord.imposta(e.target.value, ord.verso)}
          style={{ padding: "5px 8px", border: `1px solid ${C.line}`, borderRadius: 7, fontSize: 12.5, background: C.white, fontFamily: "'Inter', sans-serif" }}
        >
          <option value="">ordine predefinito</option>
          {opzioni.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!ord.chiave}
        onClick={() => ord.imposta(ord.chiave, ord.verso === "asc" ? "desc" : "asc")}
        title={ord.verso === "asc" ? "Crescente (clic per decrescente)" : "Decrescente (clic per crescente)"}
        aria-label={ord.verso === "asc" ? "Ordine crescente" : "Ordine decrescente"}
        style={{ border: `1px solid ${C.line}`, background: C.white, borderRadius: 7, padding: "4px 9px", cursor: ord.chiave ? "pointer" : "default", color: ord.chiave ? C.green : C.grafite, fontSize: 12.5 }}
      >
        {ord.verso === "asc" ? "▲" : "▼"}
      </button>
    </div>
  );
}
