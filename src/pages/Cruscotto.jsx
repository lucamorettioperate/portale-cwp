import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORI as C, STATI_PRATICA, STATI_FASE } from "../lib/cwpProgram.js";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import { leggiCruscotto } from "../lib/dati.js";
import { formatoData } from "../lib/date.js";

// Una pratica è "in scadenza" se la fase aperta scade entro questi giorni.
const SOGLIA_SCADENZA = 7;

// Riquadri del cruscotto (requisiti §8): ciascuno è anche un filtro.
const RIQUADRI = [
  { id: "in_corso", label: "Pratiche in corso", test: (p) => p.stato === "attiva" },
  {
    id: "in_scadenza",
    label: `In scadenza (≤ ${SOGLIA_SCADENZA} gg)`,
    test: (p) => p.stato === "attiva" && p.giorni_scadenza != null && p.giorni_scadenza >= 0 && p.giorni_scadenza <= SOGLIA_SCADENZA,
    tono: "amber",
  },
  { id: "scadute", label: "Scadute", test: (p) => p.stato === "attiva" && p.giorni_scadenza != null && p.giorni_scadenza < 0, tono: "red" },
  { id: "attesa_cliente", label: "In attesa del Cliente", test: (p) => p.integrazioni_in_attesa > 0 },
  { id: "da_verificare", label: "Integrazioni da verificare", test: (p) => p.integrazioni_da_verificare > 0 },
  { id: "consultazioni", label: "Consultazioni attive", test: (p) => p.consultazione_attiva },
];

/* Cruscotto del back-office: riquadri di sintesi e ricerca delle pratiche
   per organizzazione, progetto, stato, anno e fase. */
export default function Cruscotto() {
  const navigate = useNavigate();
  const [righe, setRighe] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [riquadro, setRiquadro] = useState(null);
  const [testo, setTesto] = useState("");
  const [stato, setStato] = useState("");
  const [tipo, setTipo] = useState("");
  const [anno, setAnno] = useState("");
  const [fase, setFase] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await leggiCruscotto();
      if (error) setErrore(error.message);
      else setRighe(data || []);
      setCaricamento(false);
    })();
  }, []);

  const anni = useMemo(
    () => [...new Set(righe.map((r) => r.anno_monitoraggio).filter(Boolean))].sort((a, b) => a - b),
    [righe]
  );

  const filtrate = useMemo(() => {
    const q = testo.trim().toLowerCase();
    const r = RIQUADRI.find((x) => x.id === riquadro);
    return righe.filter(
      (p) =>
        (!r || r.test(p)) &&
        (!q || [p.organizzazione, p.codice, p.titolo, p.progetto_padre_codice].some((v) => (v || "").toLowerCase().includes(q))) &&
        (!stato || p.stato === stato) &&
        (!tipo || p.tipo === tipo) &&
        (!anno || String(p.anno_monitoraggio) === anno) &&
        (!fase || String(p.fase_numero) === fase)
    );
  }, [righe, riquadro, testo, stato, tipo, anno, fase]);

  const filtriAttivi = riquadro || testo || stato || tipo || anno || fase;
  function azzera() {
    setRiquadro(null);
    setTesto("");
    setStato("");
    setTipo("");
    setAnno("");
    setFase("");
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 16px" }}>Cruscotto</h1>

        {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{errore}</div>}

        {/* Riquadri di sintesi */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
          {RIQUADRI.map((r) => {
            const n = righe.filter(r.test).length;
            const sel = riquadro === r.id;
            const colore = n > 0 && r.tono === "red" ? C.red : n > 0 && r.tono === "amber" ? C.amber : C.ink;
            return (
              <button
                key={r.id}
                onClick={() => setRiquadro(sel ? null : r.id)}
                aria-pressed={sel}
                style={{
                  textAlign: "left",
                  background: C.white,
                  border: `1px solid ${sel ? C.green : C.line}`,
                  boxShadow: sel ? `inset 0 0 0 1px ${C.green}` : "none",
                  borderRadius: 12,
                  padding: "14px 16px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontFamily: "'Archivo'", fontSize: 28, fontWeight: 800, color: colore, lineHeight: 1.1 }}>
                  {caricamento ? "…" : n}
                </div>
                <div style={{ fontSize: 12.5, color: C.grafite, fontWeight: 600, marginTop: 4 }}>{r.label}</div>
              </button>
            );
          })}
        </div>

        {/* Ricerca e filtri, in una riga */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Cerca organizzazione, codice o progetto…"
            aria-label="Cerca"
            style={{ ...campo, flex: "1 1 240px" }}
          />
          <select value={stato} onChange={(e) => setStato(e.target.value)} style={campo} aria-label="Stato pratica">
            <option value="">Tutti gli stati</option>
            {Object.entries(STATI_PRATICA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={campo} aria-label="Tipo pratica">
            <option value="">Progetti e Rapporti</option>
            <option value="progetto">Solo Progetti</option>
            <option value="rapporto">Solo Rapporti</option>
          </select>
          <select value={anno} onChange={(e) => setAnno(e.target.value)} style={campo} aria-label="Anno di monitoraggio">
            <option value="">Tutti gli anni</option>
            {anni.map((a) => <option key={a} value={a}>Anno {a}</option>)}
          </select>
          <select value={fase} onChange={(e) => setFase(e.target.value)} style={campo} aria-label="Fase corrente">
            <option value="">Tutte le fasi</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>Fase {n}</option>)}
          </select>
          {filtriAttivi && (
            <button onClick={azzera} style={{ background: "none", border: "none", color: C.green, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
              Azzera filtri
            </button>
          )}
        </div>

        {/* Elenco */}
        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.grafite, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={th}>Pratica</th>
                <th style={th}>Organizzazione</th>
                <th style={th}>Stato</th>
                <th style={th}>Fase corrente</th>
                <th style={th}>Scadenza</th>
                <th style={th}>Da fare</th>
              </tr>
            </thead>
            <tbody>
              {!caricamento && filtrate.length === 0 && (
                <tr><td colSpan={6} style={{ ...td, color: C.grafite, textAlign: "center", padding: 24 }}>Nessuna pratica corrisponde ai filtri.</td></tr>
              )}
              {filtrate.map((p) => {
                const sp = STATI_PRATICA[p.stato] || STATI_PRATICA.attiva;
                const sf = p.fase_stato ? STATI_FASE[p.fase_stato] : null;
                const g = p.giorni_scadenza;
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/pratiche?id=${p.id}`)}
                    style={{ borderTop: `1px solid ${C.line}`, cursor: "pointer" }}
                  >
                    <td style={td}>
                      <a href={`/pratiche?id=${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`/pratiche?id=${p.id}`); }} style={{ color: C.ink, fontWeight: 700, textDecoration: "none" }}>
                        {p.codice || "senza codice"}
                      </a>
                      <div style={{ fontSize: 12, color: C.grafite }}>
                        {p.tipo === "rapporto" ? `Rapporto anno ${p.anno_monitoraggio}` : p.titolo || "Progetto"}
                      </div>
                    </td>
                    <td style={td}>{p.organizzazione}</td>
                    <td style={td}><Badge bg={sp.bg} fg={sp.fg}>{sp.label}</Badge></td>
                    <td style={td}>
                      {p.fase_numero ? (
                        <>
                          <div>{p.fase_numero}. {p.fase_nome}</div>
                          {sf && <div style={{ fontSize: 11.5, color: sf.fg, fontWeight: 600 }}>{sf.label}</div>}
                        </>
                      ) : "—"}
                    </td>
                    <td style={td}>
                      {p.fase_scadenza ? formatoData(p.fase_scadenza) : "—"}
                      {g != null && (
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: g < 0 ? C.red : g <= SOGLIA_SCADENZA ? C.amber : C.grafite }}>
                          {g < 0 ? `scaduta da ${-g} gg` : g === 0 ? "scade oggi" : `tra ${g} gg`}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {p.integrazioni_da_verificare > 0 && <div>{p.integrazioni_da_verificare} integrazione/i da verificare</div>}
                      {p.integrazioni_in_attesa > 0 && <div style={{ color: C.grafite }}>{p.integrazioni_in_attesa} in attesa del Cliente</div>}
                      {p.consultazione_attiva && <div style={{ color: C.grafite }}>Consultazione fino al {formatoData(p.consultazione_chiusura)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: C.grafite, marginTop: 8 }}>
          {filtrate.length} di {righe.length} pratiche
        </div>
      </main>
    </div>
  );
}

const campo = {
  padding: "8px 10px",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  background: C.white,
};
const th = { padding: "10px 14px", fontWeight: 700 };
const td = { padding: "11px 14px", verticalAlign: "top" };
