/* =========================================================================
   Audit trail — indirizzo «/audit»
   Scopo: tabella degli eventi registrati (data, utente, operazione, pratica,
     passaggio di stato, motivazione), con ricerca testuale e pulsante per
     caricare eventi meno recenti (requisiti §10). Ogni colonna si ordina
     con un clic sull'intestazione (componente Ordinamento).
   Chi la usa: solo Amministratori (gli altri vedono un messaggio di accesso
     riservato).
   Dati: elencaAudit() (tabella "audit_event"), elencaUtenti() (RPC
     admin_elenco_utenti, per mostrare nomi al posto degli id) e
     leggiCruscotto() (RPC staff_cruscotto, per mostrare codice e
     organizzazione della pratica). Tutto da src/lib/dati.js.
   Sicurezza: il registro è scritto solo dal database (trigger
     audit_registra, script 07) e non ha policy di modifica o cancellazione:
     è immutabile. La lettura è consentita dal database a tutto lo staff
     (policy audit_select, script 07); la restrizione ai soli Amministratori
     è invece solo dell'interfaccia.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import { elencaAudit, elencaUtenti, leggiCruscotto } from "../lib/dati.js";
import { useOrdinamento, ThOrdinabile } from "../components/Ordinamento.jsx";

/* Pagina dell'audit. Nessuna prop.
   Carica gli ultimi `limite` eventi (200 all'inizio, +500 a ogni clic su
   «Carica eventi meno recenti») e li filtra nel browser con la ricerca. */
export default function Audit() {
  const { ruolo } = useAuth();
  const [eventi, setEventi] = useState([]);
  const [utenti, setUtenti] = useState({});
  const [pratiche, setPratiche] = useState({});
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [testo, setTesto] = useState("");
  const [limite, setLimite] = useState(200);

  // Rilegge eventi, utenti e pratiche quando cambia il ruolo o il limite.
  // Per i non Amministratori non si legge nulla.
  useEffect(() => {
    if (ruolo !== "admin") return;
    (async () => {
      setCaricamento(true);
      const [a, u, p] = await Promise.all([elencaAudit({ limite }), elencaUtenti(), leggiCruscotto()]);
      if (a.error) setErrore(a.error.message);
      setEventi(a.data || []);
      // Dizionari id → testo leggibile, usati nella tabella e nella ricerca.
      setUtenti(Object.fromEntries((u.data || []).map((x) => [x.id, x.nome_completo || x.email])));
      setPratiche(Object.fromEntries((p.data || []).map((x) => [x.id, `${x.codice} · ${x.organizzazione}`])));
      setCaricamento(false);
    })();
  }, [ruolo, limite]);

  // Ricerca senza distinzione di maiuscole su operazione, tipo di oggetto,
  // stati, motivazione, nome utente e pratica. Agisce solo sugli eventi già
  // caricati, non interroga il database.
  const filtrati = useMemo(() => {
    const q = testo.trim().toLowerCase();
    if (!q) return eventi;
    return eventi.filter((e) =>
      [e.operazione, e.oggetto_tipo, e.stato_precedente, e.stato_successivo, e.motivazione, utenti[e.utente_id], pratiche[e.pratica_id]]
        .some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [eventi, testo, utenti, pratiche]);

  // Ordinamento per colonna; senza scelta resta dal più recente.
  const ord = useOrdinamento(filtrati, {
    data: (e) => e.avvenuto_il,
    utente: (e) => utenti[e.utente_id] || (e.utente_id ? "utente" : "sistema"),
    operazione: (e) => e.operazione,
    pratica: (e) => pratiche[e.pratica_id],
    stati: (e) => [e.stato_precedente, e.stato_successivo].filter(Boolean).join(" → "),
    motivazione: (e) => e.motivazione,
  });

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
                <ThOrdinabile ord={ord} chiave="data" style={th}>Data e ora</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="utente" style={th}>Utente</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="operazione" style={th}>Operazione</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="pratica" style={th}>Pratica</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="stati" style={th}>Da → A</ThOrdinabile>
                <ThOrdinabile ord={ord} chiave="motivazione" style={th}>Motivazione</ThOrdinabile>
              </tr>
            </thead>
            <tbody>
              {caricamento && <tr><td colSpan={6} style={{ ...td, color: C.grafite }}>Caricamento…</td></tr>}
              {!caricamento && filtrati.length === 0 && <tr><td colSpan={6} style={{ ...td, color: C.grafite }}>Nessun evento.</td></tr>}
              {ord.ordinate.map((e) => (
                <tr key={e.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(e.avvenuto_il).toLocaleString("it-IT")}</td>
                  <td style={td}>
                    {/* Senza utente_id l'evento è del sistema (es. SQL Editor,
                        Edge Function); con id ma senza nome: utente non più in elenco. */}
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
        {/* Se sono arrivati tanti eventi quanti il limite, probabilmente ce ne sono altri. */}
        {eventi.length >= limite && (
          <button onClick={() => setLimite((l) => l + 500)} style={{ marginTop: 10, background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            Carica eventi meno recenti
          </button>
        )}
      </main>
    </div>
  );
}

// Stili delle celle di intestazione (th) e di dati (td) della tabella.
const th = { padding: "10px 12px", fontWeight: 700 };
const td = { padding: "9px 12px", verticalAlign: "top" };
