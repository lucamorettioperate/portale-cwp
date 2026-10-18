import React, { useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import Badge from "./Badge.jsx";
import { aggiungiNotaFase } from "../lib/dati.js";
import { campo, btnPrimario, btnMini, btnLink, dataOra } from "./stili.js";

/* Note di fase (backlog 10).
   Lo staff scrive note interne (solo Fondazione) o condivise con il Comune.
   Il Comune vede solo quelle condivise. Le note non si modificano: restano
   come scritte e sono registrate nell'audit. */
export default function NoteFase({ fase, pratica, note, staff, onCambio }) {
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState("");
  const [condivisa, setCondivisa] = useState(false);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  if (!staff && note.length === 0) return null;

  async function salva() {
    setErrore("");
    if (testo.trim().length < 2) return setErrore("Scrivi il testo della nota.");
    setInCorso(true);
    const { error } = await aggiungiNotaFase({ faseId: fase.id, praticaId: pratica.id, testo: testo.trim(), visibileCliente: condivisa });
    setInCorso(false);
    if (error) return setErrore("Nota non salvata: " + error.message);
    setTesto("");
    setCondivisa(false);
    setAperto(false);
    onCambio && onCambio();
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: note.length ? 6 : 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.grafite }}>
          {staff ? "Note di fase" : "Note della Fondazione"}
        </span>
        {staff && !aperto && (
          <button onClick={() => setAperto(true)} style={btnLink}>+ Aggiungi nota</button>
        )}
      </div>

      {note.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {note.map((n) => (
            <div key={n.id} style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${n.visibile_cliente ? C.green : C.ocra}`, borderRadius: 8, padding: "8px 10px", background: C.white }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11.5, color: C.grafite }}>
                <span>{dataOra(n.creato_il)}</span>
                {staff && <span>· {n.autore_nome || "—"}</span>}
                {staff && (
                  n.visibile_cliente
                    ? <Badge bg={C.greenSoft} fg={C.green}>condivisa con il Comune</Badge>
                    : <Badge bg={C.ocraSoft} fg={C.ocra}>interna</Badge>
                )}
              </div>
              <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.testo}</div>
            </div>
          ))}
        </div>
      )}

      {staff && aperto && (
        <div style={{ marginTop: 8, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Es. Verificata la delibera; manca la firma del responsabile del servizio"
            aria-label="Testo della nota"
            style={{ ...campo, resize: "vertical" }}
          />
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, margin: "8px 0 10px", color: C.ink }}>
            <input type="checkbox" checked={condivisa} onChange={(e) => setCondivisa(e.target.checked)} />
            Visibile al Comune (riceverà una notifica). Senza spunta la nota resta interna alla Fondazione.
          </label>
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={salva} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Salva nota"}</button>
            <button onClick={() => { setAperto(false); setErrore(""); }} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}
