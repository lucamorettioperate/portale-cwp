import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import { leggiCruscotto } from "../lib/dati.js";
import { elencaCalcoli, creaCalcolo } from "../lib/crediti/archivio.js";
import { formatoData } from "../lib/date.js";
import RegistroCrediti from "../components/crediti/RegistroCrediti.jsx";

const fmt = (v, d = 2) => (v == null ? "—" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }));

/* Crediti CWP — sezione riservata agli Amministratori.
   Due viste: «Calcoli» (elenco e creazione di un nuovo calcolo per pratica
   e anno) e «Registro dei crediti» (calcoli ex post confermati con numero
   di registro, componente RegistroCrediti, script 18). */
export default function Crediti() {
  const { ruolo } = useAuth();
  const navigate = useNavigate();
  const [calcoli, setCalcoli] = useState([]);
  const [pratiche, setPratiche] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [nuovo, setNuovo] = useState(null);
  const [vista, setVista] = useState("calcoli"); // "calcoli" | "registro"

  useEffect(() => {
    if (ruolo !== "admin") return;
    (async () => {
      const [c, p] = await Promise.all([elencaCalcoli(), leggiCruscotto()]);
      if (c.error) setErrore(c.error.message);
      setCalcoli(c.data || []);
      setPratiche((p.data || []).filter((x) => x.stato !== "annullata"));
      setCaricamento(false);
    })();
  }, [ruolo]);

  async function crea() {
    setErrore("");
    if (!nuovo.praticaId) return setErrore("Scegli la pratica.");
    if (!nuovo.titolo.trim()) return setErrore("Dai un titolo al calcolo.");
    const { data, error } = await creaCalcolo({
      praticaId: nuovo.praticaId,
      titolo: nuovo.titolo.trim(),
      anno: Number(nuovo.anno),
      tipo: nuovo.tipo,
      dataAvvio: nuovo.dataAvvio || null,
    });
    if (error) setErrore(error.message);
    else navigate(`/crediti/${data.id}`);
  }

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

  const annoCorrente = new Date().getFullYear();

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Crediti CWP</h1>
            <p style={{ fontSize: 13.5, color: C.grafite, margin: 0, maxWidth: 640 }}>
              Calcolo dei crediti di CO₂eq secondo la Metodologia Carbon WastePrint® v1.2: dati del territorio, delibera
              tariffaria, Banca Dati Utenze, buffer. Area riservata agli amministratori.
            </p>
          </div>
          {!nuovo && vista === "calcoli" && (
            <button
              onClick={() => setNuovo({ praticaId: pratiche[0]?.id || "", titolo: "", anno: annoCorrente - 1, tipo: "ex_post", dataAvvio: "" })}
              style={btnPrimario}
            >
              + Nuovo calcolo
            </button>
          )}
        </div>

        {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{errore}</div>}

        {/* Viste */}
        <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[["calcoli", "Calcoli"], ["registro", "Registro dei crediti"]].map(([k, t]) => (
            <button key={k} role="tab" aria-selected={vista === k} onClick={() => setVista(k)}
              style={{ ...btnMini, borderColor: vista === k ? C.green : C.line, color: vista === k ? C.green : C.grafite, background: vista === k ? C.greenSoft : C.white }}>
              {t}
            </button>
          ))}
        </div>

        {vista === "registro" && <RegistroCrediti />}

        {vista === "calcoli" && nuovo && (
          <div style={{ ...riquadro, marginBottom: 16 }}>
            <h2 style={{ fontFamily: "'Archivo'", fontSize: 16, margin: "0 0 12px" }}>Nuovo calcolo</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              <label style={lbl}>
                Pratica
                <select value={nuovo.praticaId} onChange={(e) => setNuovo({ ...nuovo, praticaId: e.target.value })} style={campo}>
                  {pratiche.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codice} · {p.organizzazione}{p.tipo === "rapporto" ? ` (Rapporto anno ${p.anno_monitoraggio})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label style={lbl}>
                Titolo
                <input value={nuovo.titolo} onChange={(e) => setNuovo({ ...nuovo, titolo: e.target.value })} style={campo} placeholder="Es. Monitoraggio 2025" />
              </label>
              <label style={lbl}>
                Anno di riferimento
                <input type="number" value={nuovo.anno} onChange={(e) => setNuovo({ ...nuovo, anno: e.target.value })} style={campo} />
              </label>
              <label style={lbl}>
                Tipo di stima
                <select value={nuovo.tipo} onChange={(e) => setNuovo({ ...nuovo, tipo: e.target.value })} style={campo}>
                  <option value="ex_post">Ex post (letture della Banca Dati Utenze)</option>
                  <option value="ex_ante">Ex ante (valori stimati)</option>
                </select>
              </label>
              <label style={lbl}>
                Avvio del progetto (solo se nel primo anno)
                <input type="date" value={nuovo.dataAvvio} onChange={(e) => setNuovo({ ...nuovo, dataAvvio: e.target.value })} style={campo} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={crea} style={btnPrimario}>Crea e apri</button>
              <button onClick={() => setNuovo(null)} style={btnMini}>Annulla</button>
            </div>
          </div>
        )}

        {vista === "calcoli" && <div style={{ ...riquadro, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.grafite, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={th}>Calcolo</th>
                <th style={th}>Pratica</th>
                <th style={th}>Anno / tipo</th>
                <th style={{ ...th, textAlign: "right" }}>Crediti netti (tCO₂eq)</th>
                <th style={th}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {caricamento && <tr><td colSpan={5} style={{ ...td, color: C.grafite }}>Caricamento…</td></tr>}
              {!caricamento && calcoli.length === 0 && (
                <tr><td colSpan={5} style={{ ...td, color: C.grafite }}>Nessun calcolo ancora. Crea il primo con «+ Nuovo calcolo».</td></tr>
              )}
              {calcoli.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/crediti/${c.id}`)} style={{ borderTop: `1px solid ${C.line}`, cursor: "pointer" }}>
                  <td style={td}>
                    <a href={`/crediti/${c.id}`} onClick={(e) => { e.preventDefault(); navigate(`/crediti/${c.id}`); }} style={{ color: C.ink, fontWeight: 700, textDecoration: "none" }}>
                      {c.titolo}
                    </a>
                    <div style={{ fontSize: 11.5, color: C.grafite }}>
                      {c.calcolato_il ? `calcolato il ${formatoData(c.calcolato_il)}` : "non ancora calcolato"}
                    </div>
                  </td>
                  <td style={td}>
                    {c.pratica?.codice}
                    <div style={{ fontSize: 11.5, color: C.grafite }}>{c.pratica?.organizzazione?.denominazione}</div>
                  </td>
                  <td style={td}>{c.anno} · {c.tipo === "ex_post" ? "ex post" : "ex ante"}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(c.crediti_netti, 3)}</td>
                  <td style={td}>
                    {c.stato === "confermato" ? <Badge bg="#dfe9db" fg={C.green}>Confermato</Badge> : <Badge bg={C.paperWarm} fg={C.grafite}>Bozza</Badge>}
                    {c.numero_registro && <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 3 }}>{c.numero_registro}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </main>
    </div>
  );
}

const riquadro = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" };
const lbl = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600 };
const campo = { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", background: C.white };
const btnPrimario = { background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnMini = { background: C.white, color: C.grafite, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const th = { padding: "10px 14px", fontWeight: 700 };
const td = { padding: "11px 14px", verticalAlign: "top" };
