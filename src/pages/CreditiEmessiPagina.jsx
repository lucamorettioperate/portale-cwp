/* =========================================================================
   CreditiEmessiPagina — indirizzo «/crediti-emessi»
   Scopo: elenco di tutti i lotti di crediti emessi dai Rapporti di
     Monitoraggio (Guida al Programma 6.3.2 e 6.3.3; script 24), con il
     totale emessi / attivi / ritirati e, per lo staff, le azioni su ogni
     lotto (caricamento sul registro, vendite, cancellazioni). L'emissione
     si fa dal dettaglio del Rapporto (riquadro «Crediti emessi»).
     Le vendite senza dichiarazione di cancellazione dopo 10 giorni sono
     evidenziate (e il database avvisa lo staff ogni giorno).
   Chi la usa: Operatori e Amministratori (gli altri vedono un messaggio).
   Dati: elencaLotti (src/lib/dati.js) sulle tabelle credito_lotto e
     credito_vendita; componenti Lotto e riepilogoLotto di CreditiEmessi.jsx.
   Sicurezza: lettura e scrittura controllate dal database (RLS e funzioni
     dello script 24).
   Registro sviluppo e deploy: capitolo «Portale (frontend)», tabella Pagine.
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import { Lotto, riepilogoLotto } from "../components/CreditiEmessi.jsx";
import { elencaLotti } from "../lib/dati.js";
import { useOrdinamento, SceltaOrdinamento } from "../components/Ordinamento.jsx";

/* Pagina dei crediti emessi. Nessuna prop. */
export default function CreditiEmessiPagina() {
  const { ruolo } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";
  const [lotti, setLotti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);

  async function carica() {
    const { data } = await elencaLotti();
    setLotti(data || []);
    setCaricamento(false);
  }
  useEffect(() => { carica(); }, []);

  const tot = lotti.reduce((t, l) => {
    const r = riepilogoLotto(l);
    return { emessi: t.emessi + l.quantita, attivi: t.attivi + r.attivi, ritirati: t.ritirati + r.ritirati };
  }, { emessi: 0, attivi: 0, ritirati: 0 });
  const n = (x) => x.toLocaleString("it-IT");
  // Ordinamento dei lotti («Ordina per»); senza scelta dal più vecchio.
  const ord = useOrdinamento(lotti, {
    codice: (l) => l.codice, emissione: (l) => l.data_emissione, quantita: (l) => l.quantita,
    rapporto: (l) => l.rapporto?.codice, organizzazione: (l) => l.rapporto?.organizzazione?.denominazione,
    registro: (l) => l.registro?.denominazione, attivi: (l) => riepilogoLotto(l).attivi,
    ritirati: (l) => riepilogoLotto(l).ritirati, daVendere: (l) => riepilogoLotto(l).daVendere,
  });

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Crediti emessi</h1>
        {!staff ? (
          <p style={{ color: C.grafite }}>Questa sezione è riservata al back-office.</p>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 14px", lineHeight: 1.5 }}>
              Crediti con ID univoco emessi dai Rapporti registrati. Sul registro scelto dal promotore sono «attivi» finché
              non vengono venduti e cancellati («ritirati»). Totale: <b>{n(tot.emessi)}</b> emessi · <b>{n(tot.attivi)}</b> attivi ·{" "}
              <b>{n(tot.ritirati)}</b> ritirati.
            </p>
            {caricamento && <div style={{ color: C.grafite }}>Caricamento…</div>}
            {!caricamento && lotti.length === 0 && <div style={{ color: C.grafite }}>Nessun credito emesso.</div>}
            {lotti.length > 1 && (
              <SceltaOrdinamento
                ord={ord}
                opzioni={[["codice", "Codice del lotto"], ["emissione", "Data di emissione"], ["quantita", "Quantità"], ["rapporto", "Rapporto"], ["organizzazione", "Organizzazione"], ["registro", "Registro"], ["attivi", "Crediti attivi"], ["ritirati", "Crediti ritirati"], ["daVendere", "Da vendere"]]}
                style={{ marginBottom: 10, flexWrap: "wrap" }}
              />
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {ord.ordinate.map((l) => <Lotto key={l.id} lotto={l} staff={staff} onCambio={carica} mostraRapporto />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
