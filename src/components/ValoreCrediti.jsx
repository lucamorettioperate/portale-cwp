/* =========================================================================
   ValoreCrediti — riquadri «Crediti in simulazione» e «Crediti in fase
   esecutiva» (richiesta di Luca Moretti del 23/10/2026).
   Scopo: mostrare il valore complessivo dei crediti, in crediti (tCO₂eq)
     e in euro:
     - in simulazione: per ogni Comune lo scenario del simulatore
       aggiornato più di recente, su tutto il periodo simulato; euro =
       ricavi dello scenario (o crediti × prezzo di riferimento per gli
       scenari salvati senza ricavi);
     - in fase esecutiva: crediti dei calcoli ex post confermati e validi
       e crediti emessi nei lotti, valorizzati al prezzo di riferimento;
       in più le vendite comunicate dal registro con il loro valore;
     - valore dei progetti (dal 23/10/2026, script 43): quanto paga il
       cliente con il listino del Caso 1 o del Caso 2, nell'ultimo scenario
       di ogni Comune e per i Progetti aperti (valoreProgetti di
       simulatore.js su caso, popolazione e periodo di ogni Progetto).
   Usato da: src/pages/Cruscotto.jsx (Dashboard dello staff: totali di
     tutto il portale) e src/pages/AreaCliente.jsx («Le mie pratiche»:
     solo le proprie organizzazioni). Nessuna prop obbligatoria;
     `titolo` facoltativo.
   Dati: leggiValoreCrediti() e leggiValoreProgetti() di src/lib/dati.js
     = RPC cruscotto_valore_crediti (script 42) e
     cruscotto_valore_progetti (script 43). Chi vede cosa lo decide il
     database (staff tutto, Comuni solo i propri); il componente mostra
     soltanto ciò che riceve. Se la lettura non riesce non mostra nulla
     (la pagina funziona comunque).
   Registro sviluppo e deploy: capitolo «Portale (frontend)»; capitolo 15
     «Calcolo crediti».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { leggiValoreCrediti, leggiValoreProgetti } from "../lib/dati.js";
import { valoreProgetti } from "../lib/crediti/simulatore.js";

// Crediti con al massimo un decimale; euro senza decimali, in formato italiano.
const crediti = (v) => Number(v || 0).toLocaleString("it-IT", { maximumFractionDigits: 1 });
const euro = (v) => "€ " + Number(v || 0).toLocaleString("it-IT", { maximumFractionDigits: 0 });

export default function ValoreCrediti({ titolo = "Valore dei crediti e dei progetti" }) {
  const [dati, setDati] = useState(null);
  const [progetti, setProgetti] = useState(null);

  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([leggiValoreCrediti(), leggiValoreProgetti()]);
      if (!c.error && c.data) setDati(c.data);
      if (!p.error && p.data) setProgetti(p.data);
    })();
  }, []);

  if (!dati) return null;
  // Valore dei Progetti aperti con le tabelle del Caso 1 / Caso 2.
  const vp = progetti ? valoreProgetti(progetti.progetti || []) : null;
  const { simulazione: s, calcolati: k, emessi: e, venduti: v } = dati;
  const prezzo = Number(dati.prezzo_riferimento || 0).toLocaleString("it-IT", { maximumFractionDigits: 2 });
  const propri = dati.ambito === "propri";

  return (
    <section aria-label={titolo} style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: "0 0 8px", color: C.ink }}>{titolo}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
        {/* Simulazione */}
        <div style={riquadro}>
          <div style={etichetta}>Crediti in simulazione</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={grande}>{crediti(s.crediti)}</span>
            <span style={unita}>crediti (tCO₂eq)</span>
          </div>
          <div style={{ ...grande, fontSize: 20, color: C.green }}>{euro(s.euro)}</div>
          <div style={nota}>
            {s.comuni ? `${s.comuni} ${s.comuni === 1 ? "Comune" : "Comuni"}: per ognuno l'ultimo scenario aggiornato, su tutto il periodo simulato.` : propri ? "Nessuna simulazione per la tua organizzazione." : "Nessuno scenario simulato."}
            {s.a_prezzo_riferimento > 0 && ` ${s.a_prezzo_riferimento} ${s.a_prezzo_riferimento === 1 ? "scenario valorizzato" : "scenari valorizzati"} a ${prezzo} €/credito (prezzo di riferimento) perché senza valore del credito salvato.`}
            {" "}Stima ex ante, non certificabile.
          </div>
        </div>
        {/* Fase esecutiva */}
        <div style={riquadro}>
          <div style={etichetta}>Crediti in fase esecutiva</div>
          <Riga titolo="Calcolati (ex post confermati)" n={k.crediti} e={k.euro} dettaglio={`${k.calcoli} ${k.calcoli === 1 ? "calcolo" : "calcoli"}`} />
          <Riga titolo="Emessi" n={e.crediti} e={e.euro} dettaglio={`${e.lotti} ${e.lotti === 1 ? "lotto" : "lotti"}`} />
          <Riga titolo="Venduti" n={v.crediti} e={v.euro} dettaglio={v.senza_valore ? `valore comunicato; ${v.senza_valore} ${v.senza_valore === 1 ? "vendita" : "vendite"} senza valore` : "valore comunicato dal registro"} />
          <div style={nota}>Calcolati ed emessi valorizzati a {prezzo} €/credito (prezzo di riferimento{propri ? "" : ", modificabile in Impostazioni"}); i crediti emessi provengono dai calcoli, quindi le righe non si sommano.</div>
        </div>
        {/* Valore dei progetti: quanto paga il cliente (Caso 1 / Caso 2) */}
        {progetti && vp && (
          <div style={riquadro}>
            <div style={etichetta}>Valore dei progetti (quanto paga il cliente)</div>
            <div style={{ ...grande, color: C.green }}>{euro(vp.euro)}</div>
            <div style={unita}>
              {vp.valorizzati} {vp.valorizzati === 1 ? "Progetto aperto" : "Progetti aperti"} con il listino Caso 1 o Caso 2 · {euro(vp.annuo)} all'anno
            </div>
            <Riga titolo="In simulazione" e={progetti.simulazione.euro} soloEuro dettaglio={`${progetti.simulazione.comuni - progetti.simulazione.senza_caso} ${progetti.simulazione.comuni - progetti.simulazione.senza_caso === 1 ? "Comune" : "Comuni"} con Caso 1 o 2`} />
            <div style={nota}>
              Tabelle dei costi del Caso 1 (progetto volontario) e del Caso 2 (obbligatorio da bando di gara), per la popolazione e il periodo di ogni Progetto.
              {vp.daIndicare > 0 && ` ${vp.daIndicare} ${vp.daIndicare === 1 ? "Progetto" : "Progetti"} senza listino indicato.`}
              {vp.senzaPopolazione > 0 && ` ${vp.senzaPopolazione} senza popolazione.`}
              {vp.stime > 0 && ` ${vp.stime} con periodo di 7 anni: valore stimato (le tabelle valgono per 10 anni).`}
              {progetti.simulazione.senza_caso > 0 && ` ${progetti.simulazione.senza_caso} ${progetti.simulazione.senza_caso === 1 ? "scenario" : "scenari"} senza Caso 1 o 2 (o salvati prima del 23/10) non contati.`}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* Una riga del riquadro «fase esecutiva»: nome, crediti, euro e dettaglio. */
function Riga({ titolo, n, e, dettaglio, soloEuro = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "5px 0", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 600 }}>
        {titolo} <span style={{ fontWeight: 400, color: C.grafite }}>· {dettaglio}</span>
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13.5, whiteSpace: "nowrap" }}>
        {!soloEuro && <><b>{crediti(n)}</b> <span style={{ color: C.grafite, fontSize: 12 }}>crediti</span> · </>}<b style={{ color: C.green }}>{euro(e)}</b>
      </span>
    </div>
  );
}

const riquadro = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", display: "grid", gap: 4, alignContent: "start" };
const etichetta = { fontSize: 12.5, color: C.grafite, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 };
const grande = { fontFamily: "'Archivo'", fontSize: 28, fontWeight: 800, color: C.ink, lineHeight: 1.1 };
const unita = { fontSize: 12.5, color: C.grafite };
const nota = { fontSize: 11.5, color: C.grafite, marginTop: 6, lineHeight: 1.45 };
