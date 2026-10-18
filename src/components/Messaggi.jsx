import React, { useEffect, useRef, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { elencaMessaggi, inviaMessaggio } from "../lib/dati.js";
import { riquadro, titoloRiquadro, campo, btnPrimario, dataOra } from "./stili.js";

/* Messaggi tra Comune e Fondazione dentro la pratica (backlog 26).
   - Comune e staff scrivono nella stessa conversazione; ogni messaggio
     genera una notifica (e un'email) per l'altra parte.
   - L'autore lo scrive il database (script 17): nessuno può firmarsi
     a nome di altri. I messaggi non si modificano e non si cancellano.
   - Sulle pratiche annullate il Comune non può più scrivere. */
export default function Messaggi({ pratica }) {
  const { ruolo, utente } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const fine = useRef(null);

  async function carica() {
    const { data } = await elencaMessaggi(pratica.id);
    setMessaggi(data || []);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pratica.id]);

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
