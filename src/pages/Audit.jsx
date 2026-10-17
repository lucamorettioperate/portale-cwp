import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import { elencaAudit, elencaUtenti, leggiCruscotto } from "../lib/dati.js";

/* Consultazione dell'audit trail (requisiti §10): solo Amministratori.
   Il registro è scritto dal database e non è modificabile. */
export default function Audit() {
  const { ruolo } = useAuth();
  const [eventi, setEventi] = useState([]);
  const [utenti, setUtenti] = useState({});
  const [pratiche, setPratiche] = useState({});
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [testo, setTesto] = useState("");
  const [limite, setLimite] = useState(200);

  useEffect(() => {
    if (ruolo !== "admin") return;
    (async () => {
      setCaricamento(true);
      const [a, u, p] = await Promise.all([elencaAudit({ limite }), elencaUtenti(), leggiCruscotto()]);
      if (a.error) setErrore(a.error.message);
      setEventi(a.data || []);
      setUtenti(Object.fromEntries((u.data || []).map((x) => [x.id, x.nome_completo || x.email])));
      setPratiche(Object.fromEntries((p.data || []).map((x) => [x.id, `${x.codice} · ${x.organizzazione}`])));
      setCaricamento(false);
    })();
  }, [ruolo, limite]);

  const filtrati = useMemo(() => {
    const q = testo.trim().toLowerCase();
    if (!q) return eventi;
    return eventi.filter((e) =>
      [e.operazione, e.oggetto_tipo, e.stato_precedente, e.stato_successivo, e.motivazione, utenti[e.utente_id], pratiche[e.pratica_id]]
        .some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [eventi, testo, utenti, pratiche]);

  if (ruolo !== "admin") {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: C.grafite }}>
          Questa sezione è riservata agli amministratori.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Audit trail</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 14px" }}>
          Registro automatico e non modificabile di tutte le operazioni rilevanti.
        </p>
        <input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Cerca per operazione, utente, pratica, motivazione…"
          aria-label="Cerca nell'audit"
          style={{ width: "100%", maxWidth: 480, boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, marginBottom: 12 }}
        />
        {errore && <div style={{ color: C.red, fontSize: 13 }}>{errore}</div>}
        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 820 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.grafite, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={th}>Data e ora</th>
                <th style={th}>Utente</th>
                <th style={th}>Operazione</th>
                <th style={th}>Pratica</th>
                <th style={th}>Da → A</th>
                <th style={th}>Motivazione</th>
              </tr>
            </thead>
            <tbody>
              {caricamento && <tr><td colSpan={6} style={{ ...td, color: C.grafite }}>Caricamento…</td></tr>}
              {!caricamento && filtrati.length === 0 && <tr><td colSpan={6} style={{ ...td, color: C.grafite }}>Nessun evento.</td></tr>}
              {filtrati.map((e) => (
                <tr key={e.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(e.avvenuto_il).toLocaleString("it-IT")}</td>
                  <td style={td}>
                    {utenti[e.utente_id] || (e.utente_id ? "utente" : "sistema")}
                    {e.ruolo && <div style={{ fontSize: 11, color: C.grafite }}>{e.ruolo}</div>}
                  </td>
                  <td style={td}>{e.operazione}</td>
                  <td style={td}>{pratiche[e.pratica_id] || "—"}</td>
                  <td style={td}>
                    {e.stato_precedente || e.stato_successivo ? (
                      <>{e.stato_precedente || "—"} → {e.stato_successivo || "—"}</>
                    ) : "—"}
                  </td>
                  <td style={td}>{e.motivazione || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {eventi.length >= limite && (
          <button onClick={() => setLimite((l) => l + 500)} style={{ marginTop: 10, background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            Carica eventi meno recenti
          </button>
        )}
      </main>
    </div>
  );
}

const th = { padding: "10px 12px", fontWeight: 700 };
const td = { padding: "9px 12px", verticalAlign: "top" };
