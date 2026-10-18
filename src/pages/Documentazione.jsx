import React from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import REVISIONI from "../../strumenti/revisioni_documenti.json";

/* Documentazione scaricabile.
   - Manuale Utente: per tutti i ruoli (in PDF; il Word solo agli Amministratori).
   - Manuale Amministratore e Registro sviluppo e deploy: solo Amministratori.
   I file sono generati da strumenti/genera_documenti.cjs; revisione e data
   arrivano dallo stesso registro delle revisioni. */
const DOCUMENTI = [
  {
    chiave: "manuale",
    titolo: "Manuale Utente",
    descrizione: "Guida passo per passo al portale per Comuni, enti e soggetti gestori: accesso, pratiche e fasi, documenti, integrazioni, consultazione pubblica, notifiche, tracciato dati.",
    percorso: "/manuali/Manuale_Utente_Portale_CWP",
    soloAdmin: false,
  },
  {
    chiave: "amministratore",
    titolo: "Manuale Amministratore",
    descrizione: "Funzioni della Fondazione passo per passo: cruscotto, pratiche e fasi, documenti, integrazioni, consultazione, pagamenti, utenti, audit, impostazioni e calcolo dei crediti CWP. Documento riservato agli Amministratori.",
    percorso: "/documentazione/Manuale_Amministratore_Portale_CWP",
    soloAdmin: true,
  },
  {
    chiave: "registro",
    titolo: "Registro sviluppo e deploy",
    descrizione: "Architettura, servizi e configurazione, database, funzionalità, procedure di rilascio, cronologia degli sviluppi, artefatti, decisioni e backlog. Documento riservato agli Amministratori.",
    percorso: "/documentazione/Registro_Dev_Deploy_Portale_CWP",
    soloAdmin: true,
  },
];

// Elenco dei documenti scaricabili per il ruolo (usato anche in "Il mio profilo").
export function ElencoDocumenti({ compatto = false }) {
  const { ruolo } = useAuth();
  const admin = ruolo === "admin";
  const visibili = DOCUMENTI.filter((d) => admin || !d.soloAdmin);
  return (
    <div style={{ display: "grid", gap: compatto ? 10 : 14 }}>
      {visibili.map((d) => {
        const revisioni = REVISIONI[d.chiave] || [];
        const rev = revisioni[revisioni.length - 1];
        return (
          <section key={d.chiave} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: compatto ? "14px 16px" : "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "'Archivo'", fontSize: compatto ? 15 : 17, margin: 0 }}>{d.titolo}</h2>
              {rev && (
                <span style={{ fontSize: 12, color: C.green, background: C.greenSoft, borderRadius: 999, padding: "2px 9px", fontWeight: 600 }}>
                  Rev. {rev.rev} · {rev.data}
                </span>
              )}
              {d.soloAdmin && (
                <span style={{ fontSize: 11.5, color: C.grafite, border: `1px solid ${C.line}`, borderRadius: 999, padding: "1px 8px" }}>solo Amministratori</span>
              )}
            </div>
            {!compatto && <p style={{ fontSize: 13.5, color: C.grafite, margin: "8px 0 12px", lineHeight: 1.5 }}>{d.descrizione}</p>}
            {!compatto && rev && <p style={{ fontSize: 12.5, color: C.grafite, margin: "0 0 12px" }}>Ultima revisione: {rev.descrizione}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: compatto ? 10 : 0 }}>
              <a href={`${d.percorso}.pdf`} target="_blank" rel="noreferrer" style={pulsante(true)}>Apri PDF</a>
              {admin && <a href={`${d.percorso}.docx`} download style={pulsante(false)}>Scarica Word</a>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function Documentazione() {
  const { ruolo } = useAuth();
  const admin = ruolo === "admin";

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>{admin ? "Documentazione" : "Manuale"}</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 18px" }}>
          {admin
            ? "Documenti del portale da scaricare in Word o PDF. Sono aggiornati a ogni nuova funzione o rilascio: la revisione indica la versione."
            : "Il manuale del portale in PDF. È aggiornato a ogni nuova funzione: la revisione indica la versione."}
        </p>

        <ElencoDocumenti />
      </main>
    </div>
  );
}

const pulsante = (principale) => ({
  display: "inline-block",
  background: principale ? C.green : C.white,
  color: principale ? C.white : C.green,
  border: `1px solid ${C.green}`,
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
});
