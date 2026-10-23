/* =========================================================================
   Marketing — indirizzo «/marketing» (solo Amministratori).
   Richiesta di Luca Moretti del 23/10/2026: strumento di marketing con
   - Comuni: tutti i Comuni italiani per regione e provincia, con PEC,
     email generica, sito, sindaco e responsabili dei tributi e
     dell'ambiente (ISTAT e IndicePA);
   - Gestori: imprese dell'Albo Nazionale Gestori Ambientali in categoria 1
     ordinaria, con attività verificate, PEC, email e referenti;
   - Campagne: testo con grafica, destinatari scelti per ogni campagna
     (solo email generiche, mai PEC), link «Approfondisci» alla landing
     page /scopri con la micro simulazione;
   - Richieste: le richieste di registrazione dalla landing page;
   - Importazioni: aggiornamento delle due banche dati.
   Dati: src/lib/marketingDati.js (tabelle mkt_* dello script 44, solo
   Amministratori) e la funzione del server «marketing».
   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import ElencoEnti from "../components/marketing/ElencoEnti.jsx";
import Campagne from "../components/marketing/Campagne.jsx";
import Richieste from "../components/marketing/Richieste.jsx";
import Importazioni from "../components/marketing/Importazioni.jsx";
import { riepilogoMarketing } from "../lib/marketingDati.js";

// Regioni italiane (nomi ISTAT, come nella banca dati).
export const REGIONI = ["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana", "Trentino-Alto Adige/Südtirol", "Umbria", "Valle d'Aosta/Vallée d'Aoste", "Veneto"];

const SCHEDE = [["comuni", "Comuni"], ["gestori", "Gestori"], ["campagne", "Campagne"], ["richieste", "Richieste"], ["importazioni", "Importazioni"]];

export default function Marketing() {
  const { ruolo } = useAuth();
  const [scheda, setScheda] = useState("comuni");
  const [riepilogo, setRiepilogo] = useState([]);

  async function caricaRiepilogo() {
    const { data } = await riepilogoMarketing();
    setRiepilogo(data || []);
  }
  useEffect(() => { if (ruolo === "admin") caricaRiepilogo(); }, [ruolo]);

  if (ruolo !== "admin") {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: C.grafite }}>Questa sezione è riservata agli amministratori.</div>
      </div>
    );
  }
  const conta = (tipo) => riepilogo.filter((r) => r.tipo === tipo).reduce((s, r) => s + Number(r.enti), 0);

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Marketing</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 14px" }}>
          Comuni e gestori da contattare, campagne email verso gli indirizzi generici e richieste di registrazione dalla pagina di simulazione.
        </p>
        <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {SCHEDE.map(([k, n]) => (
            <button key={k} role="tab" aria-selected={scheda === k} onClick={() => setScheda(k)} style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${scheda === k ? C.green : C.line}`, background: scheda === k ? C.green : C.white, color: scheda === k ? C.white : C.ink, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              {n}{k === "comuni" && conta("comune") ? ` (${conta("comune").toLocaleString("it-IT")})` : ""}{k === "gestori" && conta("gestore") ? ` (${conta("gestore").toLocaleString("it-IT")})` : ""}
            </button>
          ))}
        </div>
        {scheda === "comuni" && <ElencoEnti key="comune" tipo="comune" regioni={REGIONI} />}
        {scheda === "gestori" && <ElencoEnti key="gestore" tipo="gestore" regioni={REGIONI} />}
        {scheda === "campagne" && <Campagne regioni={REGIONI} />}
        {scheda === "richieste" && <Richieste />}
        {scheda === "importazioni" && <Importazioni riepilogo={riepilogo} onFatto={caricaRiepilogo} />}
      </main>
    </div>
  );
}
