/* =========================================================================
   PrezzoRiferimento — sezione «Prezzo di riferimento del credito» della
   pagina Impostazioni (richiesta di Luca Moretti del 23/10/2026).
   Scopo: il prezzo in euro con cui la Dashboard dà un valore ai crediti
     calcolati ed emessi (riquadro «Crediti in fase esecutiva») e agli
     scenari del simulatore salvati senza valore del credito. Iniziale 32 €,
     come il valore proposto dal simulatore.
   Usato da: src/pages/Impostazioni.jsx. Nessuna prop.
   Dati: leggiValoreCrediti (per il valore attuale) e
     impostaPrezzoRiferimento di src/lib/dati.js = RPC
     cruscotto_valore_crediti e admin_imposta_prezzo_riferimento (script
     42; solo Amministratori, valore tra 0 e 10.000 €, voce di audit).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import { leggiValoreCrediti, impostaPrezzoRiferimento } from "../../lib/dati.js";
import { riquadro, campo, etichetta, btnPrimario } from "../stili.js";

export default function PrezzoRiferimento() {
  const [valore, setValore] = useState("");
  const [esito, setEsito] = useState(null); // { testo, errore? }

  useEffect(() => {
    (async () => {
      const { data } = await leggiValoreCrediti();
      if (data) setValore(String(data.prezzo_riferimento).replace(".", ","));
    })();
  }, []);

  // Salva il prezzo (accetta la virgola decimale).
  async function salva() {
    const n = Number(String(valore).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 10000) {
      setEsito({ errore: true, testo: "Indica un prezzo tra 0 e 10.000 €." });
      return;
    }
    const { error } = await impostaPrezzoRiferimento(n);
    setEsito(error ? { errore: true, testo: error.message } : { testo: "Prezzo salvato." });
  }

  return (
    <section style={{ ...riquadro, marginBottom: 18 }}>
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 6px" }}>Prezzo di riferimento del credito</h2>
      <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 12px", lineHeight: 1.5 }}>
        Serve alla Dashboard per dare un valore in euro ai crediti calcolati ed emessi e agli scenari del simulatore salvati senza
        valore del credito. Le vendite usano invece il valore comunicato dal registro. Ogni modifica è registrata nell'Audit.
      </p>
      <label style={{ ...etichetta, maxWidth: 220 }}>
        € per credito (1 tCO₂eq)
        <input value={valore} onChange={(e) => setValore(e.target.value)} inputMode="decimal" style={campo} aria-label="Prezzo di riferimento del credito in euro" />
      </label>
      <button onClick={salva} style={btnPrimario}>Salva</button>
      {esito && <span style={{ color: esito.errore ? C.red : C.green, fontSize: 12.5, marginLeft: 10 }}>{esito.testo}</span>}
    </section>
  );
}
