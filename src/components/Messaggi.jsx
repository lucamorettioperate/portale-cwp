/* =========================================================================
   Messaggi
   Scopo: conversazione tra Comune e Fondazione Operate dentro una pratica
     (backlog 26). Mostra i messaggi in ordine di data, quelli dell'utente
     a destra, e permette di scriverne di nuovi.
   Usato da: DettaglioPratica.jsx.
   Chi lo vede: cliente/Comune della pratica, operatore, admin.
   Dati: elencaMessaggi, inviaMessaggio (src/lib/dati.js) sulla tabella
     messaggio (script 17).
   Sicurezza (garantita dal database, script 17):
     - si leggono solo i messaggi delle pratiche a cui si ha accesso
       (pratica_mia);
     - autore, ruolo, nome e ora li compila un trigger (cwp_autore_riga):
       nessuno può firmarsi a nome di altri;
     - i messaggi non si modificano e non si cancellano (nessuna policy);
     - sulle pratiche annullate il Comune non può più scrivere.
     Ogni nuovo messaggio genera una notifica (e un'email) all'altra parte:
     la crea il database, non questo componente.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React, { useEffect, useRef, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { elencaMessaggi, inviaMessaggio } from "../lib/dati.js";
import { riquadro, titoloRiquadro, campo, btnPrimario, dataOra } from "./stili.js";

/* Riquadro «Messaggi» di una pratica.
   Props: pratica (riga della tabella pratica; servono id e stato). */
export default function Messaggi({ pratica }) {
  const { ruolo, utente } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  // Segnaposto in fondo all'elenco: dopo l'invio si scorre fin lì.
  const fine = useRef(null);

  // Rilegge tutti i messaggi della pratica.
  async function carica() {
    const { data } = await elencaMessaggi(pratica.id);
    setMessaggi(data || []);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pratica.id]);

  // Invia il messaggio (testo senza spazi iniziali e finali), poi ricarica.
  // Effetto: il database notifica l'altra parte (notifica interna + email).
  async function invia() {
    setErrore("");
    if (!testo.trim()) return;
    setInCorso(true);
    const { error } = await inviaMessaggio(pratica.id, testo.trim());
    setInCorso(false);
    if (error) return setErrore("Messaggio non inviato: " + error.message);
    setTesto("");
    await carica();
    fine.current?.scrollIntoView({ block: "nearest" });
  }

  // Stessa regola delle RLS (script 17): qui serve solo a nascondere il
  // campo; se mancasse, il database rifiuterebbe comunque l'inserimento.
  const puoScrivere = staff || pratica.stato !== "annullata";

  return (
    <div style={riquadro}>
      <h3 style={{ ...titoloRiquadro, marginBottom: 4 }}>Messaggi</h3>
      <p style={{ fontSize: 12.5, color: C.grafite, margin: "0 0 12px" }}>
        {staff
          ? "Conversazione con il Comune su questa pratica. Il Comune riceve una notifica per ogni messaggio."
          : "Scrivi qui a Fondazione Operate per domande su questa pratica. Riceverai una notifica alla risposta."}
      </p>

      <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
        {messaggi.length === 0 && <div style={{ fontSize: 13, color: C.grafite }}>Nessun messaggio.</div>}
        {messaggi.map((m) => {
          // autore_ruolo è registrato dal database al momento dell'invio.
          const daFondazione = m.autore_ruolo === "operatore" || m.autore_ruolo === "admin";
          const mio = m.autore_id === utente?.id;
          return (
            <div
              key={m.id}
              style={{
                justifySelf: mio ? "end" : "start",
                maxWidth: "82%",
                background: daFondazione ? C.greenSoft : C.paperWarm,
                border: `1px solid ${C.line}`,
                borderRadius: 10,
                padding: "8px 11px",
              }}
            >
              <div style={{ fontSize: 11.5, color: C.grafite, marginBottom: 3 }}>
                <b style={{ color: C.ink }}>
                  {daFondazione ? `Fondazione Operate${m.autore_nome ? " · " + m.autore_nome : ""}` : m.autore_nome || "Comune"}
                </b>{" "}
                · {dataOra(m.creato_il)}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.testo}</div>
            </div>
          );
        })}
        <div ref={fine} />
      </div>

      {puoScrivere ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end" }}>
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="Scrivi un messaggio…"
            aria-label="Testo del messaggio"
            style={{ ...campo, resize: "vertical", flex: 1 }}
          />
          <button onClick={invia} disabled={inCorso || !testo.trim()} style={{ ...btnPrimario, opacity: testo.trim() ? 1 : 0.6 }}>
            {inCorso ? "…" : "Invia"}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: C.grafite, marginTop: 10 }}>La pratica è annullata: non è più possibile scrivere.</div>
      )}
      {errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}
    </div>
  );
}
