/* =========================================================================
   Cruscotto (nel menu «Dashboard») — indirizzo «/» per Operatore e Admin
   (src/App.jsx, HomePerRuolo)
   Scopo: (requisiti §8) riquadri di sintesi cliccabili (pratiche in corso,
     in scadenza, scadute, fase aperta senza scadenza — rilievo N04: una
     data mancante non conta come «in regola» —, in attesa del Cliente, integrazioni da
     verificare, consultazioni attive) e tabella di tutte le pratiche,
     Progetti e Rapporti, con ricerca e filtri per stato, tipo, anno e fase.
     Un clic su una riga apre la pratica in «/pratiche?id=…». Per ogni
     pratica la colonna «Avanzamento» mostra la barra a LED delle 7 fasi
     (componente BarraFasi: accese le completate, spente quelle da fare,
     la settima verde). Ogni colonna si ordina con un clic sull'intestazione
     (componente Ordinamento).
   Chi la usa: Operatore e Amministratore.
   Dati: leggiCruscotto() di src/lib/dati.js = RPC staff_cruscotto
     (script 09): una riga per pratica con fase corrente, scadenza, giorni
     alla scadenza, conteggio integrazioni e stato della consultazione;
     leggiFasiPratiche() = stato di tutte le fasi (tabella fase) per la
     barra a LED.
     Tutti i filtri lavorano nel browser su queste righe.
   Sicurezza: staff_cruscotto rifiuta chi non è staff (app_is_staff, che
     richiede anche la verifica a due fattori se attiva). La pagina non ha
     un proprio controllo di ruolo: un cliente non ci arriva perché
     HomePerRuolo gli mostra l'Area Cliente.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORI as C, STATI_PRATICA, STATI_FASE } from "../lib/cwpProgram.js";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import { leggiCruscotto, leggiFasiPratiche } from "../lib/dati.js";
import BarraFasi from "../components/BarraFasi.jsx";
import { useOrdinamento, ThOrdinabile, SceltaOrdinamento } from "../components/Ordinamento.jsx";
import { useTelefono } from "../lib/useTelefono.js";
import { formatoData } from "../lib/date.js";
import { SOGLIA_SCADENZA, inScadenza, scaduta, senzaScadenza } from "../lib/scadenze.js";

// Riquadri del cruscotto (requisiti §8): ciascuno è anche un filtro.
// - test(p): vero se la riga p del cruscotto rientra nel riquadro
// - tono: colore del numero quando è > 0 ("amber" o "red"); assente = neutro.
// Le regole delle scadenze sono in src/lib/scadenze.js (rilievo N04).
const RIQUADRI = [
  { id: "in_corso", label: "Pratiche in corso", test: (p) => p.stato === "attiva" },
  { id: "in_scadenza", label: `In scadenza (≤ ${SOGLIA_SCADENZA} gg)`, test: inScadenza, tono: "amber" },
  { id: "scadute", label: "Scadute", test: scaduta, tono: "red" },
  // Rilievo N04: una fase aperta senza data non è «in regola», è senza
  // scadenza nota. Così lo zero di «In scadenza» e «Scadute» non sembra una
  // garanzia: queste pratiche si contano a parte.
  { id: "senza_scadenza", label: "Fase aperta senza scadenza", test: senzaScadenza, tono: "amber" },
  // Integrazioni non risolte: senza documento di risposta = attende il
  // Cliente; con documento = tocca alla Fondazione verificarlo.
  { id: "attesa_cliente", label: "In attesa del Cliente", test: (p) => p.integrazioni_in_attesa > 0 },
  { id: "da_verificare", label: "Integrazioni da verificare", test: (p) => p.integrazioni_da_verificare > 0 },
  { id: "consultazioni", label: "Feedback pubblico aperti", test: (p) => p.consultazione_attiva },
];

/* Cruscotto del back-office: riquadri di sintesi e ricerca delle pratiche
   per organizzazione, progetto, stato, anno e fase. Nessuna prop.
   I filtri non sono salvati: si azzerano ricaricando la pagina. */
export default function Cruscotto() {
  const navigate = useNavigate();
  const [righe, setRighe] = useState([]);
  // Fasi di ogni pratica per la barra a LED: { [pratica_id]: [fasi] }.
  const [fasiPerPratica, setFasiPerPratica] = useState({});
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  // Riquadro selezionato come filtro (id di RIQUADRI) oppure null.
  const [riquadro, setRiquadro] = useState(null);
  const [testo, setTesto] = useState("");
  const [stato, setStato] = useState("");
  const [tipo, setTipo] = useState("");
  const [anno, setAnno] = useState("");
  const [fase, setFase] = useState("");

  // Lettura una tantum all'apertura della pagina.
  useEffect(() => {
    (async () => {
      const { data, error } = await leggiCruscotto();
      if (error) setErrore(error.message);
      else setRighe(data || []);
      setCaricamento(false);
      // Poi lo stato delle fasi per la barra a LED (se non si legge, la
      // barra resta spenta: la Dashboard funziona comunque).
      const { data: fasi } = await leggiFasiPratiche((data || []).map((r) => r.id));
      const mappa = {};
      for (const f of fasi || []) (mappa[f.pratica_id] ||= []).push(f);
      setFasiPerPratica(mappa);
    })();
  }, []);

  // Anni di monitoraggio presenti (solo i Rapporti ne hanno uno), per il filtro.
  const anni = useMemo(
    () => [...new Set(righe.map((r) => r.anno_monitoraggio).filter(Boolean))].sort((a, b) => a - b),
    [righe]
  );

  // Righe che rispettano TUTTI i filtri attivi (riquadro, testo, stato,
  // tipo, anno, fase). I valori delle tendine sono stringhe: per anno e fase
  // si confronta con String(...).
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

  // Ordinamento per colonna (clic sulle intestazioni).
  const completate = (p) => (fasiPerPratica[p.id] || []).filter((f) => f.stato === "completata").length;
  const telefono = useTelefono();
  const ord = useOrdinamento(filtrate, {
    pratica: (p) => p.codice,
    organizzazione: (p) => p.organizzazione,
    avanzamento: (p) => completate(p),
    stato: (p) => (STATI_PRATICA[p.stato] || {}).label || p.stato,
    fase: (p) => p.fase_numero,
    scadenza: (p) => p.fase_scadenza,
    dafare: (p) => (p.integrazioni_da_verificare || 0) + (p.integrazioni_in_attesa || 0) + (p.consultazione_attiva ? 1 : 0),
  });
  // Toglie tutti i filtri (pulsante «Azzera filtri»).
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
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 16px" }}>Dashboard</h1>

        {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{errore}</div>}

        {/* Riquadri di sintesi */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
          {RIQUADRI.map((r) => {
            // Il conteggio è su tutte le pratiche, non su quelle filtrate.
            // Un secondo clic sul riquadro selezionato toglie il filtro.
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
          {/* Sul telefono (global.css, «tabella-schede») ogni riga diventa una
              scheda con le etichette delle colonne; l'ordine si sceglie sopra. */}
          {telefono && (
            <SceltaOrdinamento ord={ord} opzioni={[["pratica", "Pratica"], ["organizzazione", "Organizzazione"], ["avanzamento", "Avanzamento"], ["stato", "Stato"], ["fase", "Fase corrente"], ["scadenza", "Scadenza"], ["dafare", "Da fare"]]} style={{ padding: "10px 12px", flexWrap: "wrap" }} />
          )}
          <table className="tabella-schede" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.grafite, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <ThOrdinabile ord={ord} chiave="pratica" style={th}>Pratica</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="organizzazione" style={th}>Organizzazione</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="avanzamento" style={th}>Avanzamento</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="stato" style={th}>Stato</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="fase" style={th}>Fase corrente</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="scadenza" style={th}>Scadenza</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="dafare" style={th}>Da fare</ThOrdinabile>
              </tr>
            </thead>
            <tbody>
              {!caricamento && filtrate.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, color: C.grafite, textAlign: "center", padding: 24 }}>Nessuna pratica corrisponde ai filtri.</td></tr>
              )}
              {ord.ordinate.map((p) => {
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
                      {/* Link vero (apribile in nuova scheda) ma, al clic
                          normale, navigazione interna senza ricaricare. */}
                      <a href={`/pratiche?id=${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`/pratiche?id=${p.id}`); }} style={{ color: C.ink, fontWeight: 700, textDecoration: "none" }}>
                        {p.codice || "senza codice"}
                      </a>
                      <div style={{ fontSize: 12, color: C.grafite }}>
                        {p.tipo === "rapporto" ? `Rapporto anno ${p.anno_monitoraggio}` : p.titolo || "Progetto"}
                      </div>
                    </td>
                    <td style={td} data-etichetta="Organizzazione">{p.organizzazione}</td>
                    <td style={{ ...td, verticalAlign: "middle" }} data-etichetta="Avanzamento"><BarraFasi fasi={fasiPerPratica[p.id] || []} /></td>
                    <td style={td} data-etichetta="Stato"><Badge bg={sp.bg} fg={sp.fg}>{sp.label}</Badge></td>
                    <td style={td} data-etichetta="Fase corrente">
                      {p.fase_numero ? (
                        <>
                          <div>{p.fase_numero}. {p.fase_nome}</div>
                          {sf && <div style={{ fontSize: 11.5, color: sf.fg, fontWeight: 600 }}>{sf.label}</div>}
                        </>
                      ) : "—"}
                    </td>
                    <td style={td} data-etichetta="Scadenza">
                      {p.fase_scadenza ? formatoData(p.fase_scadenza) : "—"}
                      {senzaScadenza(p) && <div style={{ fontSize: 11.5, fontWeight: 600, color: C.amber }}>nessuna scadenza nota</div>}
                      {g != null && (
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: g < 0 ? C.red : g <= SOGLIA_SCADENZA ? C.amber : C.grafite }}>
                          {g < 0 ? `scaduta da ${-g} gg` : g === 0 ? "scade oggi" : `tra ${g} gg`}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, fontSize: 12 }} data-etichetta="Da fare" className="cella-vuota-nascosta">
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

// Stili di campi di ricerca/tendine e celle della tabella.
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
