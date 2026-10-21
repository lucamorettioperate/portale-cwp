/* =========================================================================
   OggettoEModifiche — cella «Oggetto e modifiche» delle pagine Audit e
   Audit User (collaudo V01, D05, 20/10/2026).
   Mostra tipo, nome e codice breve dell'oggetto di un evento dell'audit e,
   per le modifiche, i campi cambiati «da → a» (chiusi: si aprono con un
   clic). Legge solo l'evento già caricato: nessun accesso ai dati.
   Testi lunghi (collaudo V05, D05-R1, 21/10/2026): nella riga il valore
   resta accorciato, ma «Testo completo» mostra i valori interi prima e
   dopo (a capo e caratteri speciali conservati, sempre come testo, mai
   come codice) e la parte tolta / aggiunta, così due note con lo stesso
   inizio non sembrano più uguali.
   Funzioni di lettura in src/lib/auditDettaglio.js.
   ========================================================================= */
import React, { useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { etichettaOggetto, modificheEvento, valoreBreve, valoreCompleto, valoreLungo, differenzaTesto } from "../lib/auditDettaglio.js";

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
              <Modifica key={i} m={m} />
            ))}
            {modifiche.length > 40 && <li>… altre {modifiche.length - 40}</li>}
          </ul>
        </details>
      )}
    </div>
  );
}


/* Una riga «campo: da → a» con, per i testi lunghi, il pulsante «Testo
   completo». Prop: m = { campo, da, a } (da modificheEvento). React mostra
   i valori come testo: un contenuto con < > o simili non viene eseguito. */
function Modifica({ m }) {
  const [aperta, setAperta] = useState(false);
  const lungo = valoreLungo(m.da) || valoreLungo(m.a);
  const diff = lungo ? differenzaTesto(m.da, m.a) : null;
  return (
    <li style={{ marginBottom: 2 }}>
      <span style={{ color: C.ink }}>{m.campo}</span>: {valoreBreve(m.da)} → <strong style={{ color: C.ink }}>{valoreBreve(m.a)}</strong>
      {lungo && (
        <button
          type="button"
          onClick={() => setAperta(!aperta)}
          aria-expanded={aperta}
          style={{ marginLeft: 6, background: "none", border: "none", padding: 0, color: C.green, fontWeight: 700, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}
        >
          {aperta ? "Chiudi" : "Testo completo"}
        </button>
      )}
      {aperta && (
        <div style={{ margin: "5px 0 6px", padding: "8px 10px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, color: C.ink, maxWidth: 560 }}>
          {(diff.tolto || diff.aggiunto) && (
            <div style={{ marginBottom: 6 }}>
              {diff.tolto && <div><b style={{ color: C.red }}>Tolto:</b> <span style={testoIntero}>{diff.tolto}</span></div>}
              {diff.aggiunto && <div><b style={{ color: C.green }}>Aggiunto:</b> <span style={testoIntero}>{diff.aggiunto}</span></div>}
              <div style={{ fontSize: 10.5, color: C.grafite }}>dopo i primi {diff.inizio} caratteri uguali</div>
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: 11 }}>Prima</div>
          <div style={{ ...testoIntero, marginBottom: 6 }}>{valoreCompleto(m.da) || "—"}</div>
          <div style={{ fontWeight: 700, fontSize: 11 }}>Dopo</div>
          <div style={testoIntero}>{valoreCompleto(m.a) || "—"}</div>
        </div>
      )}
    </li>
  );
}

// Testo intero: a capo conservati, parole lunghe spezzate.
const testoIntero = { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 11.5 };
