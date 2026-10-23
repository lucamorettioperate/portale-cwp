/* =========================================================================
   Richieste — richieste di registrazione arrivate dalla landing page
   (/scopri) della sezione Marketing (richiesta di Luca Moretti del
   23/10/2026, tabella mkt_richiesta dello script 44). Ogni richiesta è già
   arrivata a tutti gli Amministratori come notifica ed email; qui si
   leggono i dettagli (referente, recapiti, messaggio, simulazione fatta)
   e si segna come gestita, con note.
   Nessuna prop. Dati: elencaRichieste, aggiornaRichiesta (marketingDati.js).
   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import { elencaRichieste, aggiornaRichiesta } from "../../lib/marketingDati.js";
import { btnMini, campo } from "../stili.js";

const euro = (v) => (v == null ? "—" : "€ " + Math.round(v).toLocaleString("it-IT"));

export default function Richieste() {
  const [elenco, setElenco] = useState([]);
  const [errore, setErrore] = useState("");
  const [soloAperte, setSoloAperte] = useState(true);

  async function carica() {
    const { data, error } = await elencaRichieste();
    setErrore(error ? error.message : "");
    setElenco(data || []);
  }
  useEffect(() => { carica(); }, []);

  async function segna(r, campi) {
    const { error } = await aggiornaRichiesta(r.id, campi);
    if (error) setErrore(error.message); else carica();
  }

  const mostrate = elenco.filter((r) => !soloAperte || !r.gestita);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize: 13, color: C.grafite, margin: 0 }}>Richieste di registrazione inviate dalla pagina «Approfondisci» delle campagne. Ogni richiesta arriva anche come notifica ed email a tutti gli Amministratori.</p>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={soloAperte} onChange={(e) => setSoloAperte(e.target.checked)} /> solo da gestire</label>
      </div>
      {errore && <div style={{ color: C.red, fontSize: 13 }}>{errore}</div>}
      {mostrate.length === 0 && <div style={{ fontSize: 13, color: C.grafite }}>Nessuna richiesta{soloAperte ? " da gestire" : ""}.</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {mostrate.map((r) => <Scheda key={r.id} r={r} onSegna={(campi) => segna(r, campi)} />)}
      </div>
    </div>
  );
}

function Scheda({ r, onSegna }) {
  const [note, setNote] = useState(r.note || "");
  const s = r.simulazione;
  return (
    <div style={{ background: C.white, border: `1px solid ${r.gestita ? C.line : C.green}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: 15 }}>{r.ente}</b>
        <span style={{ fontSize: 12, color: C.grafite }}>{new Date(r.creato_il).toLocaleString("it-IT")}{r.gestita ? " · gestita" : ""}</span>
      </div>
      <div style={{ fontSize: 13, marginTop: 4 }}>
        {r.referente}{r.ruolo ? ` (${r.ruolo})` : ""} · <a href={`mailto:${r.email}`} style={{ color: C.green }}>{r.email}</a>{r.telefono ? ` · ${r.telefono}` : ""}
      </div>
      {r.ente_rif && <div style={{ fontSize: 12, color: C.grafite }}>Dalla campagna inviata a {r.ente_rif.denominazione}{r.ente_rif.sigla ? ` (${r.ente_rif.sigla})` : ""}</div>}
      {r.messaggio && <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{r.messaggio}</div>}
      {s?.totali && (
        <div style={{ fontSize: 12.5, marginTop: 6, background: C.paper, borderRadius: 8, padding: "6px 10px" }}>
          Simulazione: {Number(s.abitanti || 0).toLocaleString("it-IT")} abitanti, {s.anni_durata} anni, {s.caso === "caso2" ? "Caso 2" : "Caso 1"} · crediti {Number(s.totali.crediti).toLocaleString("it-IT")} · ricavi {euro(s.totali.ricavi)} · costi {euro(s.totali.costi)} · margine <b>{euro(s.totali.margine)}</b>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne (es. chiamato il…)" style={{ ...campo, flex: "1 1 240px" }} aria-label="Note" />
        <button onClick={() => onSegna({ note: note.trim() || null })} style={btnMini}>Salva note</button>
        <button onClick={() => onSegna({ gestita: !r.gestita, note: note.trim() || null })} style={btnMini}>{r.gestita ? "Riapri" : "Segna come gestita"}</button>
      </div>
    </div>
  );
}
