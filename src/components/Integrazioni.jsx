import React, { useRef, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Badge from "./Badge.jsx";
import {
  caricaDocumento,
  rispondiIntegrazione,
  chiudiIntegrazione,
  urlDocumento,
} from "../lib/dati.js";
import { ACCEPT, FORMATI_LEGGIBILI } from "../lib/file.js";
import { formatoData } from "../lib/date.js";

/* Richieste di integrazione di una fase (requisiti §4).
   Ciclo: l'Operatore richiede → il Cliente carica un documento e risponde
   → l'Operatore chiude la richiesta. Con la chiusura della fase la
   possibilità di integrare termina. */
export default function Integrazioni({ pratica, fase, richieste, onCambio }) {
  const { ruolo } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";
  if (!richieste.length) return null;

  const faseAperta = fase.stato !== "completata" && fase.stato !== "non_iniziata";
  const praticaAttiva = pratica.stato === "attiva";

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.grafite }}>Richieste di integrazione</div>
      {richieste.map((r) => (
        <Richiesta
          key={r.id}
          richiesta={r}
          pratica={pratica}
          fase={fase}
          staff={staff}
          puoRispondere={!staff && !r.risolta && faseAperta && praticaAttiva}
          onCambio={onCambio}
        />
      ))}
    </div>
  );
}

function Richiesta({ richiesta: r, pratica, fase, staff, puoRispondere, onCambio }) {
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [nota, setNota] = useState("");
  const [chiusura, setChiusura] = useState(false);
  const [motivazione, setMotivazione] = useState("");
  const inputRef = useRef(null);

  const stato = r.risolta
    ? { label: "Chiusa", bg: "#dfe9db", fg: C.green }
    : r.documento_risposta_id
      ? { label: "Risposta ricevuta", bg: C.ocraSoft, fg: C.ocra }
      : { label: "In attesa del Cliente", bg: "#f6dcd6", fg: C.red };

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrore("");
    setInCorso(true);
    const { data: doc, error } = await caricaDocumento({ praticaId: pratica.id, faseId: fase.id, file });
    if (error) {
      setErrore("Caricamento non riuscito: " + error.message);
    } else {
      const { error: e2 } = await rispondiIntegrazione(r.id, doc.id, nota.trim() || null);
      if (e2) setErrore("Risposta non registrata: " + e2.message);
      else {
        setNota("");
        onCambio();
      }
    }
    setInCorso(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function chiudi() {
    setErrore("");
    // Senza risposta del Cliente la chiusura è un'eccezione: serve la motivazione.
    if (!r.documento_risposta_id && !chiusura) {
      setChiusura(true);
      return;
    }
    setInCorso(true);
    const { error } = await chiudiIntegrazione(r.id, motivazione.trim() || null);
    setInCorso(false);
    if (error) setErrore(error.message);
    else {
      setChiusura(false);
      onCambio();
    }
  }

  async function scarica() {
    const { data } = await urlDocumento(r.documento.storage_path);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div
      style={{
        border: `1px solid ${r.risolta ? C.line : C.ocra}`,
        borderRadius: 9,
        padding: "10px 12px",
        background: r.risolta ? "#faf8f3" : C.white,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>{r.descrizione}</div>
        <Badge bg={stato.bg} fg={stato.fg}>{stato.label}</Badge>
      </div>
      <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 4 }}>
        Richiesta il {formatoData(r.creato_il)}
        {r.risposto_il && <> · risposta il {formatoData(r.risposto_il)}</>}
        {r.risolta_il && <> · chiusa il {formatoData(r.risolta_il)}</>}
      </div>

      {r.documento && (
        <div style={{ fontSize: 12.5, marginTop: 8 }}>
          Documento: {" "}
          <button onClick={scarica} style={linkBtn}>
            {r.documento.nome} (v{r.documento.versione})
          </button>
          {r.nota_risposta && <div style={{ color: C.grafite, marginTop: 4 }}>Nota: {r.nota_risposta}</div>}
        </div>
      )}

      {/* Cliente: carica il documento richiesto */}
      {puoRispondere && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota per la Fondazione (facoltativa)"
            aria-label="Nota per la Fondazione"
            style={{ ...campo, flex: 1, minWidth: 180 }}
          />
          <label style={{ ...btnPrimario, opacity: inCorso ? 0.6 : 1 }}>
            {inCorso ? "Caricamento…" : r.documento_risposta_id ? "Carica di nuovo" : "Carica integrazione"}
            <input ref={inputRef} type="file" accept={ACCEPT} onChange={onFile} disabled={inCorso} style={{ display: "none" }} />
          </label>
          <div style={{ fontSize: 11.5, color: C.grafite, width: "100%" }}>Formati accettati: {FORMATI_LEGGIBILI}</div>
        </div>
      )}
      {!staff && !r.risolta && fase.stato === "completata" && (
        <div style={{ fontSize: 12, color: C.grafite, marginTop: 8 }}>La fase è chiusa: non è più possibile integrare.</div>
      )}

      {/* Staff: chiusura della richiesta */}
      {staff && !r.risolta && (
        <div style={{ marginTop: 10 }}>
          {chiusura && (
            <input
              value={motivazione}
              onChange={(e) => setMotivazione(e.target.value)}
              placeholder="Motivazione: il Cliente non ha ancora risposto"
              aria-label="Motivazione della chiusura"
              style={{ ...campo, width: "100%", boxSizing: "border-box", marginBottom: 6 }}
            />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={chiudi} disabled={inCorso} style={btnPrimario}>
              {r.documento_risposta_id ? "Accetta e chiudi" : chiusura ? "Conferma chiusura" : "Chiudi senza risposta"}
            </button>
            {chiusura && (
              <button onClick={() => setChiusura(false)} style={btnMini}>Annulla</button>
            )}
          </div>
        </div>
      )}

      {errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}
    </div>
  );
}

const campo = {
  padding: "7px 10px",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  background: C.white,
};
const btnPrimario = {
  background: C.green,
  color: C.white,
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-block",
};
const btnMini = {
  background: C.white,
  color: C.grafite,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
const linkBtn = {
  background: "none",
  border: "none",
  padding: 0,
  color: C.green,
  textDecoration: "underline",
  cursor: "pointer",
  fontSize: 12.5,
};
