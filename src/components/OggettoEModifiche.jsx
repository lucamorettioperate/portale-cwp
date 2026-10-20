/* =========================================================================
   OggettoEModifiche — cella «Oggetto e modifiche» delle pagine Audit e
   Audit User (collaudo V01, D05, 20/10/2026).
   Mostra tipo, nome e codice breve dell'oggetto di un evento dell'audit e,
   per le modifiche, i campi cambiati «da → a» (chiusi: si aprono con un
   clic). Legge solo l'evento già caricato: nessun accesso ai dati.
   Funzioni di lettura in src/lib/auditDettaglio.js.
   ========================================================================= */
import React from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { etichettaOggetto, modificheEvento, valoreBreve } from "../lib/auditDettaglio.js";

/* Oggetto dell'evento e, se è una modifica, l'elenco dei campi cambiati
   (chiuso: si apre con un clic). Props: evento, nomi { id: nome }.
*/
export default function OggettoEModifiche({ evento, nomi }) {
  const modifiche = modificheEvento(evento);
  return (
    <div style={{ minWidth: 200 }}>
      <div>{etichettaOggetto(evento, nomi)}</div>
      {modifiche.length > 0 && (
        <details style={{ marginTop: 3 }}>
          <summary style={{ cursor: "pointer", color: C.green, fontWeight: 600, fontSize: 12 }}>
            {modifiche.length === 1 ? "1 modifica" : `${modifiche.length} modifiche`}
          </summary>
          <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 11.5, color: C.grafite }}>
            {modifiche.slice(0, 40).map((m, i) => (
              <li key={i}>
                <span style={{ color: C.ink }}>{m.campo}</span>: {valoreBreve(m.da)} → <strong style={{ color: C.ink }}>{valoreBreve(m.a)}</strong>
              </li>
            ))}
            {modifiche.length > 40 && <li>… altre {modifiche.length - 40}</li>}
          </ul>
        </details>
      )}
    </div>
  );
}

