import React from "react";
import { Link } from "react-router-dom";
import { COLORI as C } from "../lib/cwpProgram.js";

const FILE = "/modelli/Tracciato_dati_CWP_v1.xlsx";

const FOGLI = [
  ["1_Anagrafica", "Ente, anno di riferimento, gestore, tariffa puntuale, ripartizione PEF della delibera", "Comune"],
  ["2_Rifiuti", "Tonnellate raccolte nell'anno per codice EER (Catasto ISPRA, MUD, O.R.So.)", "Comune / gestore"],
  ["3_Classi_domestiche", "Classi delle utenze domestiche: numero di utenze e coefficiente Kb", "Comune (delibera TARI)"],
  ["4_Classi_non_domestiche", "Categorie non domestiche: numero, superficie e coefficiente Kd", "Comune (delibera TARI)"],
  ["5_Conferimenti", "Banca Dati Utenze: totali annui per utenza e tipo di rifiuto", "Gestore"],
  ["6_Letture", "In alternativa al foglio 5: le singole letture (svuotamenti, pesate)", "Gestore"],
  ["7_Riuso", "Beni conferiti al centro del riuso, per utenza", "Gestore / centro del riuso"],
  ["Codici", "Codici ammessi per tipologie di rifiuto, utenze, beni e punti di conferimento", "—"],
];

/* Pagina pubblica: standard dei dati da inviare per il calcolo dei crediti.
   Il link si può mandare a Comuni e gestori anche senza credenziali. */
export default function FormatoDati() {
  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <header style={{ background: C.white, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <img src="/loghi/carbonwasteprint.png" alt="Carbon WastePrint" style={{ height: 56, width: "auto" }} />
          <span style={{ fontSize: 12, color: C.grafite }}>Programma di</span>
          <img src="/loghi/fondazione-operate.png" alt="Fondazione Operate" style={{ height: 34, width: "auto" }} />
          <span style={{ flex: 1 }} />
          <Link to="/" style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>Accedi al portale</Link>
        </div>
      </header>

      <main style={{ maxWidth: 920, margin: "0 auto", padding: "26px 20px 48px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 26, margin: "0 0 6px", letterSpacing: -0.4 }}>
          Formato dei dati per il calcolo dei crediti
        </h1>
        <p style={{ fontSize: 14.5, color: C.grafite, margin: "0 0 20px", lineHeight: 1.55, maxWidth: 720 }}>
          Per calcolare i crediti di carbonio secondo la Metodologia Carbon WastePrint, Comuni e gestori del servizio
          di raccolta forniscono i dati in un formato unico. Scaricate il file, compilatelo seguendo il foglio
          «Istruzioni» e caricatelo nella pratica del vostro progetto.
        </p>

        <a
          href={FILE}
          download
          style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.green, color: C.white, textDecoration: "none", fontWeight: 700, fontSize: 15, padding: "13px 20px", borderRadius: 10 }}
        >
          Scarica il tracciato dati (Excel)
        </a>
        <div style={{ fontSize: 12.5, color: C.grafite, marginTop: 8 }}>
          Tracciato_dati_CWP_v1.xlsx · versione 1.0 · ottobre 2026
        </div>

        <section style={riquadro}>
          <h2 style={h2}>Cosa contiene</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: "left", color: C.grafite, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  <th style={th}>Foglio</th>
                  <th style={th}>Dati</th>
                  <th style={th}>Chi li fornisce</th>
                </tr>
              </thead>
              <tbody>
                {FOGLI.map(([f, d, chi]) => (
                  <tr key={f} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{f}</td>
                    <td style={td}>{d}</td>
                    <td style={{ ...td, color: C.grafite }}>{chi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ ...riquadro, background: "#f6dcd6", borderColor: "#e5b9b0" }}>
          <h2 style={{ ...h2, color: C.red }}>Protezione dei dati personali</h2>
          <p style={p}>
            Il file <b>non deve contenere dati che identificano le persone</b>: niente nomi, indirizzi, codici fiscali,
            partite IVA, email o telefoni delle utenze. Ogni utenza si indica con un <b>codice anonimo</b>, sempre lo
            stesso negli anni (ad esempio il codice interno del gestore). La tabella che collega codici e persone resta
            al Comune o al gestore e non va inviata.
          </p>
        </section>

        <section style={riquadro}>
          <h2 style={h2}>Come inviarlo</h2>
          <ol style={{ ...p, paddingLeft: 20, margin: 0 }}>
            <li>Compilate i fogli partendo dalla riga sotto le intestazioni, senza modificarle.</li>
            <li>Per i dati delle utenze basta uno dei due fogli: totali annui (5) oppure singole letture (6).</li>
            <li>Caricate il file nel portale, nella pratica del vostro progetto.</li>
            <li>
              File molto grandi (oltre 50 MB o oltre 1 milione di righe): salvate ogni foglio come CSV con le stesse
              intestazioni (ad esempio <code>6_Letture.csv</code>) e riunite i file in un archivio ZIP.
            </li>
          </ol>
        </section>

        <p style={{ fontSize: 12.5, color: C.grafite, marginTop: 22 }}>
          Per domande sul tracciato scrivete alla Fondazione Operate tramite la pratica nel portale.
        </p>
      </main>
    </div>
  );
}

const riquadro = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginTop: 22 };
const h2 = { fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 10px" };
const p = { fontSize: 14, lineHeight: 1.6, margin: 0 };
const th = { padding: "8px 10px", fontWeight: 700 };
const td = { padding: "9px 10px", verticalAlign: "top", lineHeight: 1.45 };
