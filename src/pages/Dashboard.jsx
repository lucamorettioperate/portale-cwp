import React, { useState, useMemo } from "react";
import { FASI, ATTORI, COLORI as C } from "../lib/cwpProgram.js";
import { PROGETTI_ESEMPIO } from "../lib/datiEsempio.js";
import Pill from "../components/Pill.jsx";
import Timeline from "../components/Timeline.jsx";
import ProjectCard from "../components/ProjectCard.jsx";
import Stat from "../components/Stat.jsx";
import AzioniRuolo from "../components/AzioniRuolo.jsx";
import RapportoForm from "../components/RapportoForm.jsx";
import { statoColor } from "../lib/stato.js";

/* Dashboard operativa multi-ruolo — porta nel portale reale il prototipo
   approvato. I dati sono ancora di esempio (in memoria); verranno sostituiti
   dalle pratiche reali di Supabase nel passo successivo. */
export default function Dashboard() {
  const [ruolo, setRuolo] = useState("operate");
  const [progetti, setProgetti] = useState(PROGETTI_ESEMPIO);
  const [selId, setSelId] = useState(PROGETTI_ESEMPIO[0].id);
  const [tab, setTab] = useState("flusso");

  const sel = useMemo(() => progetti.find((p) => p.id === selId), [progetti, selId]);

  const avanzaFase = () => {
    setProgetti((prev) =>
      prev.map((p) => {
        if (p.id !== selId) return p;
        const next = Math.min(6, p.faseCorrente + 1);
        const nuovoGiorno = FASI[next - 1].giorno;
        const validato = next === 6;
        return {
          ...p,
          faseCorrente: next,
          giornoCorrente: nuovoGiorno,
          stato: validato ? "Validato" : p.faseCorrente >= 2 ? "In istruttoria" : "Adesione",
          creditiEmessi: validato ? p.creditiStimati : p.creditiEmessi,
        };
      })
    );
  };

  const att = ATTORI[ruolo];

  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink }}>
      <style>{`
        @media (max-width: 820px){ .cwp-grid{ grid-template-columns: 1fr !important; } .cwp-side{ order: 2; } }
      `}</style>

      {/* Topbar */}
      <header
        style={{
          background: C.ink,
          color: C.white,
          padding: "16px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 9,
              background: C.green,
              display: "grid",
              placeItems: "center",
              fontFamily: "'Archivo'",
              fontWeight: 800,
              fontSize: 17,
              color: C.white,
            }}
          >
            CW
          </div>
          <div>
            <div style={{ fontFamily: "'Archivo'", fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>
              Carbon WastePrint<span style={{ color: C.amber }}>®</span>
            </div>
            <div style={{ fontSize: 11, color: "#b9bdb2" }}>
              Portale di validazione · Programma certificato ISO 14064-2:2019
            </div>
          </div>
        </div>

        {/* Selettore ruolo */}
        <div style={{ display: "flex", gap: 6, background: "#2b3127", padding: 5, borderRadius: 10 }}>
          {Object.entries(ATTORI).map(([k, a]) => (
            <button
              key={k}
              onClick={() => setRuolo(k)}
              style={{
                background: ruolo === k ? a.color : "transparent",
                color: ruolo === k ? C.white : "#b9bdb2",
                border: "none",
                borderRadius: 7,
                padding: "7px 13px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {a.short}
            </button>
          ))}
        </div>
      </header>

      {/* Barra ruolo attivo */}
      <div
        style={{
          background: att.soft,
          borderBottom: `1px solid ${C.line}`,
          padding: "10px 28px",
          fontSize: 12.5,
          color: C.ink,
        }}
      >
        Stai operando come <b style={{ color: att.color }}>{att.label}</b>
        <span style={{ color: C.grafite }}> — {att.sub}</span>
      </div>

      {/* Layout */}
      <div
        className="cwp-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 22,
          padding: "22px 28px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        {/* Sidebar progetti */}
        <aside className="cwp-side">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontFamily: "'Archivo'", fontSize: 14, margin: 0, letterSpacing: 0.2, textTransform: "uppercase", color: C.grafite }}>
              Progetti
            </h2>
            {ruolo === "promotore" && (
              <button
                style={{
                  background: C.green,
                  color: C.white,
                  border: "none",
                  borderRadius: 7,
                  padding: "6px 11px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Nuova adesione
              </button>
            )}
          </div>
          {progetti.map((p) => (
            <ProjectCard key={p.id} p={p} active={p.id === selId} onClick={() => setSelId(p.id)} />
          ))}
        </aside>

        {/* Main */}
        <main>
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              padding: "22px 24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>{sel.id}</div>
                <h1 style={{ fontFamily: "'Archivo'", fontSize: 24, margin: "3px 0 4px", letterSpacing: -0.5 }}>
                  {sel.nome}
                </h1>
                <div style={{ fontSize: 13, color: C.grafite }}>
                  {sel.promotore} · {sel.abitanti.toLocaleString("it-IT")} abitanti · {sel.tipo}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Pill bg={statoColor(sel.stato).bg} fg={statoColor(sel.stato).fg}>
                  {sel.stato}
                </Pill>
                <div style={{ fontSize: 12, color: C.grafite, marginTop: 8 }}>Periodo: {sel.periodo}</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginTop: 18, borderBottom: `1px solid ${C.line}` }}>
              {[
                ["flusso", "Flusso di validazione"],
                ["dati", "Dati e crediti"],
                ["rapporto", "Rapporto consuntivo"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: `2px solid ${tab === k ? C.green : "transparent"}`,
                    padding: "9px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: tab === k ? C.ink : C.grafite,
                    cursor: "pointer",
                    marginBottom: -1,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            {tab === "flusso" && (
              <>
                <div
                  style={{
                    background: C.white,
                    border: `1px solid ${C.line}`,
                    borderRadius: 14,
                    padding: "8px 18px 20px",
                  }}
                >
                  <Timeline progetto={sel} />
                </div>

                <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
                  {FASI.map((f) => {
                    const done = sel.giornoCorrente > f.giorno;
                    const current = sel.faseCorrente === f.n;
                    const a = ATTORI[f.attore];
                    return (
                      <div
                        key={f.n}
                        style={{
                          background: current ? a.soft : C.white,
                          border: `1px solid ${current ? a.color : C.line}`,
                          borderRadius: 12,
                          padding: "14px 18px",
                          display: "flex",
                          gap: 16,
                          alignItems: "flex-start",
                          opacity: !done && !current && f.giorno > sel.giornoCorrente ? 0.62 : 1,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'Archivo'",
                            fontWeight: 800,
                            fontSize: 15,
                            color: done ? C.green : current ? a.color : C.line,
                            minWidth: 54,
                          }}
                        >
                          G{f.giorno}
                          <div style={{ fontSize: 10, color: C.grafite, fontWeight: 600 }}>FASE {f.n}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{f.titolo}</span>
                            {done && <Pill bg={C.greenSoft} fg={C.green}>completata</Pill>}
                            {current && <Pill bg={a.soft} fg={a.color}>in corso</Pill>}
                          </div>
                          <div style={{ fontSize: 12.5, color: C.grafite, marginTop: 5, lineHeight: 1.5 }}>
                            {f.descr}
                          </div>
                          <div style={{ fontSize: 11.5, color: a.color, marginTop: 6, fontWeight: 600 }}>
                            Responsabile: {f.responsabile}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginTop: 18,
                    background: C.white,
                    border: `1px solid ${C.line}`,
                    borderRadius: 14,
                    padding: "18px 20px",
                  }}
                >
                  <h3 style={{ margin: "0 0 12px", fontFamily: "'Archivo'", fontSize: 15 }}>Azioni disponibili</h3>
                  <AzioniRuolo ruolo={ruolo} progetto={sel} onAvanza={avanzaFase} />
                </div>
              </>
            )}

            {tab === "dati" && (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Stat label="Rifiuti urbani" value={sel.rifiutiTon.toLocaleString("it-IT")} unit="t/anno" />
                  <Stat label="Raccolta differenziata" value={sel.differenziata} unit="%" accent={C.green} />
                  <Stat label="Crediti stimati" value={sel.creditiStimati.toLocaleString("it-IT")} unit="tCO₂eq" accent={C.amber} />
                  <Stat
                    label="Crediti emessi"
                    value={sel.creditiEmessi.toLocaleString("it-IT")}
                    unit="tCO₂eq"
                    accent={sel.creditiEmessi > 0 ? C.green : C.line}
                  />
                </div>
                <div
                  style={{
                    background: C.white,
                    border: `1px solid ${C.line}`,
                    borderRadius: 14,
                    padding: "20px 22px",
                  }}
                >
                  <h3 style={{ margin: "0 0 6px", fontFamily: "'Archivo'", fontSize: 16 }}>
                    Crediti di carbonio CO₂eq
                  </h3>
                  <p style={{ fontSize: 13, color: C.grafite, lineHeight: 1.6, margin: 0 }}>
                    I crediti sono emessi dopo verifica positiva di Fondazione Operate e dell'ente di
                    validazione terzo, caricati su registro pubblico e vendibili sui mercati volontari.
                    I ricavi sono reinvestiti nella gestione rifiuti del territorio e nella premialità
                    alle utenze virtuose, con benefici su orizzonte 7–10 anni. La proprietà dei crediti
                    resta in capo al soggetto promotore del progetto.
                  </p>
                  <div
                    style={{
                      marginTop: 16,
                      display: "flex",
                      gap: 18,
                      flexWrap: "wrap",
                      paddingTop: 16,
                      borderTop: `1px solid ${C.line}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: C.grafite, fontWeight: 600 }}>REGISTRO</div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {sel.creditiEmessi > 0 ? "Pubblicato · mercato volontario" : "In attesa di emissione"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.grafite, fontWeight: 600 }}>PERIODO DI RIFERIMENTO</div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{sel.periodo}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.grafite, fontWeight: 600 }}>MONITORAGGIO</div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Annuale · 1 gen → 31 dic</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "rapporto" && (
              <div
                style={{
                  background: C.white,
                  border: `1px solid ${C.line}`,
                  borderRadius: 14,
                  padding: "20px 22px",
                }}
              >
                <h3 style={{ margin: "0 0 4px", fontFamily: "'Archivo'", fontSize: 16 }}>
                  Rapporto consuntivo annuale sui conferimenti
                </h3>
                <p style={{ fontSize: 12.5, color: C.grafite, margin: "0 0 18px" }}>
                  {ruolo === "promotore"
                    ? "Inserisci i dati di conferimento per l'anno di monitoraggio."
                    : "Vista in sola consultazione — la compilazione spetta al Soggetto Promotore del Progetto."}
                </p>
                <div style={{ opacity: ruolo === "promotore" ? 1 : 0.55, pointerEvents: ruolo === "promotore" ? "auto" : "none" }}>
                  <RapportoForm />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer
        style={{
          textAlign: "center",
          fontSize: 11.5,
          color: C.grafite,
          padding: "24px 20px 32px",
        }}
      >
        Fondazione Operate — Soggetto Promotore del Programma · Anteprima con dati di esempio.
        Programma validato da RINA Services SpA il 31/10/2025 ai sensi ISO 14064-2:2019.
      </footer>
    </div>
  );
}
