import React, { useEffect, useState } from "react";
import { COLORI as C, STATI_PRATICA, STATI_FASE } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import DettaglioPratica from "../components/DettaglioPratica.jsx";
import { elencaProgetti } from "../lib/dati.js";

/* Area Cliente: l'organizzazione vede solo le proprie pratiche
   (garantito dalla sicurezza del database), in sola consultazione. */
export default function AreaCliente() {
  const { profilo } = useAuth();
  const [progetti, setProgetti] = useState([]);
  const [selId, setSelId] = useState(null);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    elencaProgetti().then(({ data }) => {
      setProgetti(data || []);
      if (data && data.length) setSelId(data[0].id);
      setCaricamento(false);
    });
  }, []);

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />

      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "24px 24px",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px", letterSpacing: -0.4 }}>
            Le mie pratiche
          </h1>
          <p style={{ fontSize: 13.5, color: C.grafite, margin: 0 }}>
            Stato e avanzamento dei progetti della tua organizzazione.
          </p>
        </div>

        {caricamento && <div style={{ color: C.grafite, fontSize: 13 }}>Caricamento…</div>}

        {!caricamento && progetti.length === 0 && (
          <div
            style={{
              background: C.white,
              border: `1px dashed ${C.line}`,
              borderRadius: 12,
              padding: "32px 24px",
              textAlign: "center",
              color: C.grafite,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Non risultano ancora pratiche a tuo carico.<br />
            Quando la Fondazione registrerà il tuo progetto, lo vedrai qui.
          </div>
        )}

        {progetti.length > 0 && (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Riepilogo pratiche (card compatte) */}
            <div style={{ display: "grid", gap: 10 }}>
              {progetti.map((p) => {
                const st = STATI_PRATICA[p.stato] || STATI_PRATICA.attiva;
                const attivo = p.id === selId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelId(p.id)}
                    style={{
                      textAlign: "left",
                      background: C.white,
                      border: `1px solid ${attivo ? C.green : C.line}`,
                      borderLeft: `4px solid ${attivo ? C.green : C.line}`,
                      borderRadius: 12,
                      padding: "15px 18px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'Archivo'", fontWeight: 700, fontSize: 15 }}>
                        {p.titolo || "Progetto"}
                      </span>
                      <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.grafite, marginTop: 3 }}>
                      {p.codice || "senza codice"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dettaglio della pratica selezionata (sola lettura per il cliente) */}
            {selId && <DettaglioPratica praticaId={selId} />}
          </div>
        )}
      </div>
    </div>
  );
}
