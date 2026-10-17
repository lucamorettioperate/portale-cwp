import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Badge from "./Badge.jsx";
import {
  leggiConsultazione,
  apriConsultazione,
  chiudiConsultazione,
  inviaCommento,
  moderaCommento,
  rispondiCommento,
  elencaDocumenti,
} from "../lib/dati.js";

/* Consultazione pubblica (fase 3): pubblicazione documento per 30 giorni,
   raccolta commenti anonimi, moderazione (staff), risposta (cliente). */
export default function Consultazione({ praticaId }) {
  const { ruolo, utente } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";

  const [cons, setCons] = useState(null);
  const [documenti, setDocumenti] = useState([]);
  const [docSel, setDocSel] = useState("");
  const [caricamento, setCaricamento] = useState(true);
  const [nuovoCommento, setNuovoCommento] = useState("");
  const [azione, setAzione] = useState(false);
  const [errore, setErrore] = useState("");

  async function carica() {
    setCaricamento(true);
    const { data } = await leggiConsultazione(praticaId);
    setCons(data);
    if (!data) {
      const { data: docs } = await elencaDocumenti(praticaId);
      setDocumenti(docs || []);
      if (docs && docs.length) setDocSel(docs[0].id);
    }
    setCaricamento(false);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId]);

  if (caricamento) return <Riquadro>Caricamento…</Riquadro>;

  const giorniResidui = cons?.data_chiusura
    ? Math.ceil((new Date(cons.data_chiusura) - new Date()) / (24 * 60 * 60 * 1000))
    : null;

  // Apertura consultazione (staff)
  async function apri() {
    if (!docSel) return;
    setAzione(true);
    const { data, error } = await apriConsultazione({ praticaId, documentoId: docSel });
    if (!error) {
      await carica();
    }
    setAzione(false);
  }

  async function chiudi() {
    setAzione(true);
    await chiudiConsultazione(cons.id);
    await carica();
    setAzione(false);
  }

  async function invia() {
    if (!nuovoCommento.trim()) return;
    setAzione(true);
    setErrore("");
    const { error } = await inviaCommento({
      consultazioneId: cons.id,
      praticaId,
      testo: nuovoCommento.trim(),
      autoreUtenteId: utente?.id,
    });
    if (error) setErrore("Osservazione non inviata: " + error.message);
    else setNuovoCommento("");
    await carica();
    setAzione(false);
  }

  async function rispondi(id, testo) {
    setAzione(true);
    setErrore("");
    const { error } = await rispondiCommento(id, testo);
    if (error) setErrore("Risposta non salvata: " + error.message);
    await carica();
    setAzione(false);
    return !error;
  }

  // Il cliente vede solo le osservazioni ammesse alla consultazione;
  // lo staff le vede tutte, comprese quelle da moderare.
  const commentiVisibili = (cons?.commenti || []).filter(
    (c) => staff || c.stato === "pubblicato" || c.stato === "risposto"
  );

  async function modera(id, stato) {
    setAzione(true);
    const motivazione = stato === "non_pubblicato" ? "Non ammesso dal moderatore" : null;
    await moderaCommento(id, stato, motivazione);
    await carica();
    setAzione(false);
  }

  return (
    <Riquadro>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: 0 }}>Consultazione pubblica</h3>
        {cons && (
          <Badge bg={cons.attiva ? C.greenSoft : C.paperWarm} fg={cons.attiva ? C.green : C.grafite}>
            {cons.attiva ? "Attiva" : "Chiusa"}
          </Badge>
        )}
      </div>

      {/* Nessuna consultazione: lo staff può aprirla */}
      {!cons && (
        <div>
          {staff ? (
            documenti.length ? (
              <div>
                <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 10px" }}>
                  Pubblica un documento per avviare la consultazione di 30 giorni.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={docSel} onChange={(e) => setDocSel(e.target.value)} style={campo}>
                    {documenti.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome} (v{d.versione})
                      </option>
                    ))}
                  </select>
                  <button onClick={apri} disabled={azione} style={btnPrimario}>
                    Apri consultazione
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: C.grafite, margin: 0 }}>
                Carica prima un documento per poterlo pubblicare in consultazione.
              </p>
            )
          ) : (
            <p style={{ fontSize: 13, color: C.grafite, margin: 0 }}>
              Nessuna consultazione pubblica in corso.
            </p>
          )}
        </div>
      )}

      {/* Consultazione presente */}
      {cons && (
        <div>
          <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 14 }}>
            Dal {cons.data_apertura} al {cons.data_chiusura}
            {cons.attiva && giorniResidui != null && (
              <> · <b style={{ color: C.ink }}>{giorniResidui > 0 ? `${giorniResidui} giorni rimanenti` : "in scadenza"}</b></>
            )}
          </div>

          {/* Invio commento (utente autenticato) */}
          {cons.attiva && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                value={nuovoCommento}
                onChange={(e) => setNuovoCommento(e.target.value)}
                placeholder="Scrivi un'osservazione…"
                style={{ ...campo, flex: 1 }}
              />
              <button onClick={invia} disabled={azione} style={btnPrimario}>
                Invia
              </button>
            </div>
          )}

          {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{errore}</div>}

          {/* Elenco commenti */}
          <div style={{ display: "grid", gap: 8 }}>
            {commentiVisibili.length === 0 && (
              <div style={{ fontSize: 13, color: C.grafite }}>Nessuna osservazione ricevuta.</div>
            )}
            {commentiVisibili.map((c) => (
              <div
                key={c.id}
                style={{
                  border: `1px solid ${C.line}`,
                  borderRadius: 9,
                  padding: "11px 13px",
                  background: c.stato === "non_pubblicato" ? "#faf8f3" : C.white,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  {/* Pubblicato in forma anonima */}
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.grafite }}>Partecipante</span>
                  <Badge bg={statoCommento(c.stato).bg} fg={statoCommento(c.stato).fg}>
                    {statoCommento(c.stato).label}
                  </Badge>
                </div>
                <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>{c.testo}</div>
                {c.risposta_testo && (
                  <div style={{ fontSize: 12.5, marginTop: 8, padding: "8px 10px", background: C.greenSoft, borderRadius: 7, color: C.ink }}>
                    <b>Risposta:</b> {c.risposta_testo}
                  </div>
                )}

                {/* Risposta del Cliente alle osservazioni ammesse */}
                {!staff && (c.stato === "pubblicato" || c.stato === "risposto") && (
                  <RispostaCliente commento={c} inCorso={azione} onRispondi={rispondi} />
                )}

                {/* Moderazione (staff) */}
                {staff && cons.attiva && (c.stato === "ricevuto" || c.stato === "pubblicato") && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {c.stato === "ricevuto" && (
                      <button onClick={() => modera(c.id, "pubblicato")} disabled={azione} style={btnMini}>
                        Pubblica
                      </button>
                    )}
                    <button onClick={() => modera(c.id, "non_pubblicato")} disabled={azione} style={{ ...btnMini, color: C.red, borderColor: C.line }}>
                      Non pubblicare
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {staff && cons.attiva && (
            <button onClick={chiudi} disabled={azione} style={{ ...btnSecondario, marginTop: 14 }}>
              Chiudi consultazione
            </button>
          )}
        </div>
      )}
    </Riquadro>
  );
}

function RispostaCliente({ commento, inCorso, onRispondi }) {
  const [aperta, setAperta] = useState(false);
  const [testo, setTesto] = useState(commento.risposta_testo || "");

  if (!aperta) {
    return (
      <button onClick={() => setAperta(true)} style={{ ...btnMini, marginTop: 10 }}>
        {commento.risposta_testo ? "Modifica risposta" : "Rispondi"}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 10 }}>
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        rows={3}
        placeholder="Scrivi la risposta all'osservazione…"
        aria-label="Risposta all'osservazione"
        style={{ ...campo, width: "100%", boxSizing: "border-box", resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          onClick={async () => {
            if (await onRispondi(commento.id, testo)) setAperta(false);
          }}
          disabled={inCorso || !testo.trim()}
          style={btnPrimario}
        >
          Salva risposta
        </button>
        <button onClick={() => setAperta(false)} style={btnMini}>Annulla</button>
      </div>
    </div>
  );
}

function statoCommento(stato) {
  switch (stato) {
    case "pubblicato":
      return { label: "Pubblicato", bg: "#dfe9db", fg: C.green };
    case "non_pubblicato":
      return { label: "Non pubblicato", bg: "#f6dcd6", fg: C.red };
    case "risposto":
      return { label: "Risposto", bg: C.greenSoft, fg: C.green };
    default:
      return { label: "Ricevuto", bg: C.paperWarm, fg: C.grafite };
  }
}

function Riquadro({ children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
      {children}
    </div>
  );
}

const campo = {
  padding: "9px 11px",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  fontSize: 13.5,
  fontFamily: "'Inter', sans-serif",
  boxSizing: "border-box",
  background: C.white,
};
const btnPrimario = {
  background: C.green,
  color: C.white,
  border: "none",
  borderRadius: 8,
  padding: "9px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
const btnSecondario = {
  background: C.white,
  color: C.grafite,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
const btnMini = {
  background: C.white,
  color: C.green,
  border: `1px solid ${C.green}`,
  borderRadius: 7,
  padding: "5px 11px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
