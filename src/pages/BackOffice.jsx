import React, { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { COLORI as C, STATI_PRATICA } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import DettaglioPratica from "../components/DettaglioPratica.jsx";
import NuovoProgetto from "../components/NuovoProgetto.jsx";
import { elencaProgetti } from "../lib/dati.js";

/* Back-office: elenco progetti dal database, dettaglio con 7 fasi,
   creazione di nuovi progetti. Vista per Operatore/Admin. */
export default function BackOffice() {
  const { ruolo } = useAuth();
  const [progetti, setProgetti] = useState([]);
  // La pratica aperta è nell'indirizzo (?id=…): così cruscotto e notifiche
  // possono aprire direttamente una pratica.
  const [params, setParams] = useSearchParams();
  const selId = params.get("id");
  const setSelId = (id) => setParams(id ? { id } : {});
  const [cerca, setCerca] = useState("");
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [creazione, setCreazione] = useState(false);

  async function ricarica() {
    setCaricamento(true);
    const { data, error } = await elencaProgetti();
    if (error) setErrore(error.message);
    else {
      setProgetti(data || []);
      if (!params.get("id") && data && data.length) setSelId(data[0].id);
    }
    setCaricamento(false);
  }

  useEffect(() => {
    ricarica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staff = ruolo === "operatore" || ruolo === "admin";
  if (ruolo && !staff) return <Navigate to="/" replace />;

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />

      <div
        className="layout-pratiche"
        style={{
          display: "grid",
          gap: 22,
          padding: "22px 24px",
          maxWidth: 1320,
          margin: "0 auto",
        }}
      >
        {/* Lista progetti */}
        <aside>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2
              style={{
                fontFamily: "'Archivo'",
                fontSize: 13,
                margin: 0,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: C.grafite,
              }}
            >
              Progetti
            </h2>
            {staff && (
              <button
                onClick={() => setCreazione(true)}
                style={{
                  background: C.green,
                  color: C.white,
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Nuovo progetto
              </button>
            )}
          </div>

          {caricamento && <div style={{ color: C.grafite, fontSize: 13 }}>Caricamento…</div>}
          {errore && <div style={{ color: C.red, fontSize: 13 }}>{errore}</div>}

          {!caricamento && !errore && progetti.length === 0 && (
            <div
              style={{
                background: C.white,
                border: `1px dashed ${C.line}`,
                borderRadius: 12,
                padding: "24px 18px",
                textAlign: "center",
                color: C.grafite,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Nessun progetto ancora.
              {staff && <><br />Crea il primo con “+ Nuovo progetto”.</>}
            </div>
          )}

          {progetti.length > 4 && (
            <input
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cerca…"
              aria-label="Cerca progetto"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, marginBottom: 10 }}
            />
          )}

          {progetti
            .filter((p) => !cerca.trim() || [p.codice, p.titolo, p.organizzazione?.denominazione].some((v) => (v || "").toLowerCase().includes(cerca.trim().toLowerCase())))
            .map((p) => {
            const st = STATI_PRATICA[p.stato] || STATI_PRATICA.attiva;
            const attivo = p.id === selId;
            return (
              <button
                key={p.id}
                onClick={() => setSelId(p.id)}
                style={{
                  textAlign: "left",
                  width: "100%",
                  background: attivo ? C.white : "transparent",
                  border: `1px solid ${attivo ? C.green : C.line}`,
                  borderLeft: `4px solid ${attivo ? C.green : C.line}`,
                  borderRadius: 10,
                  padding: "13px 15px",
                  cursor: "pointer",
                  marginBottom: 9,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Archivo'", fontWeight: 700, fontSize: 13.5, color: C.ink }}>
                    {p.organizzazione?.denominazione || "—"}
                  </span>
                  <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
                </div>
                <div style={{ fontSize: 12, color: C.grafite, marginTop: 3 }}>
                  {p.codice || "senza codice"} · {p.titolo || "—"}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Dettaglio */}
        <main>
          {selId ? (
            <DettaglioPratica key={selId} praticaId={selId} onAggiornato={ricarica} onApri={setSelId} />
          ) : (
            !caricamento && (
              <div
                style={{
                  background: C.white,
                  border: `1px solid ${C.line}`,
                  borderRadius: 14,
                  padding: "40px 28px",
                  textAlign: "center",
                  color: C.grafite,
                }}
              >
                Seleziona un progetto a sinistra per vederne il dettaglio.
              </div>
            )
          )}
        </main>
      </div>

      {creazione && (
        <NuovoProgetto
          onChiudi={() => setCreazione(false)}
          onCreato={(id) => {
            setCreazione(false);
            ricarica().then(() => id && setSelId(id));
          }}
        />
      )}
    </div>
  );
}
