import React from "react";
import { FASI, ATTORI, COLORI as C } from "../lib/cwpProgram.js";
import { supabaseConfigurato } from "../lib/supabase.js";

/* Schermata iniziale — conferma che l'impalcatura del portale funziona
   e mostra il flusso ufficiale. Le dashboard per ruolo arrivano nel passo
   successivo. */
export default function Home() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: C.green,
            display: "grid",
            placeItems: "center",
            fontFamily: "'Archivo'",
            fontWeight: 800,
            fontSize: 19,
            color: C.white,
          }}
        >
          CW
        </div>
        <div>
          <h1 style={{ fontFamily: "'Archivo'", fontSize: 26, margin: 0, letterSpacing: -0.5 }}>
            Portale Carbon WastePrint<span style={{ color: C.amber }}>®</span>
          </h1>
          <div style={{ fontSize: 13, color: C.grafite }}>
            Programma validato da RINA Services SpA · ISO 14064-2:2019
          </div>
        </div>
      </header>

      <p style={{ fontSize: 15, color: C.grafite, lineHeight: 1.6, maxWidth: 680 }}>
        Portale operativo per la certificazione dei crediti di carbonio da gestione
        rifiuti urbani. Accompagna comuni e aziende, Fondazione Operate e l'ente
        validatore lungo le sei fasi ufficiali del Programma.
      </p>

      {/* Stato impostazione */}
      <div
        style={{
          background: supabaseConfigurato ? C.greenSoft : C.ocraSoft,
          border: `1px solid ${supabaseConfigurato ? C.green : C.amber}`,
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13.5,
          margin: "20px 0 32px",
        }}
      >
        {supabaseConfigurato
          ? "✓ Backend collegato: il portale è connesso al database."
          : "Impalcatura attiva. Backend (database e login) non ancora collegato — prossimo passo."}
      </div>

      {/* Le 6 fasi */}
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 18 }}>Le sei fasi del Programma</h2>
      <div style={{ display: "grid", gap: 10, marginBottom: 32 }}>
        {FASI.map((f) => {
          const a = ATTORI[f.attore];
          return (
            <div
              key={f.n}
              style={{
                background: C.white,
                border: `1px solid ${C.line}`,
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "'Archivo'",
                  fontWeight: 800,
                  fontSize: 15,
                  color: C.green,
                  minWidth: 48,
                }}
              >
                G{f.giorno}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.titolo}</div>
                <div style={{ fontSize: 12, color: a.color, fontWeight: 600, marginTop: 2 }}>
                  {f.responsabile}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer style={{ fontSize: 12, color: C.grafite, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
        Fondazione Operate — Soggetto Promotore del Programma
      </footer>
    </div>
  );
}
