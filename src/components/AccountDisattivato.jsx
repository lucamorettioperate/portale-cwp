/* =========================================================================
   AccountDisattivato — pagina mostrata a chi entra con un account
   disattivato da un Amministratore (collaudo V05, O01, 21/10/2026).
   Prima il Cliente disattivato vedeva archivi vuoti («Non risultano ancora
   pratiche…», «Non ci sono ancora documenti…»), che si potevano scambiare
   per l'assenza di pratiche. Ora un messaggio esplicito dice che l'account
   è disattivato e a chi rivolgersi. Nessun dato riservato è letto qui:
   le regole del database continuano a bloccare pratiche e documenti.
   Usato da: src/App.jsx (Protetta), quando profilo.attivo è false.
   ========================================================================= */
import React from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";

/* Nessuna prop: legge email ed esci() da useAuth(). */
export default function AccountDisattivato() {
  const { utente, esci } = useAuth();
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.paper, padding: 20 }}>
      <div role="alert" style={{ width: "100%", maxWidth: 440, background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 26px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 20, margin: "0 0 8px" }}>Account disattivato</h1>
        <p style={{ fontSize: 13.5, color: C.ink, margin: "0 0 10px", lineHeight: 1.55 }}>
          L'account {utente?.email ? <strong>{utente.email}</strong> : null} è stato disattivato da un Amministratore del
          portale Carbon WastePrint: per ora non si possono consultare pratiche e documenti.
        </p>
        <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 18px", lineHeight: 1.55 }}>
          Se pensi che sia un errore o ti serve di nuovo l'accesso, scrivi alla Fondazione Operate (al tuo referente del
          Programma CWP). Quando l'account sarà riattivato basterà entrare di nuovo.
        </p>
        <button
          onClick={() => esci()}
          style={{ background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
        >
          Esci
        </button>
      </div>
    </div>
  );
}
