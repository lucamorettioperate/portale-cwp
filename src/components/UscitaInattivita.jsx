/* =========================================================================
   UscitaInattivita — chiusura automatica della sessione dopo un periodo
   senza attività (richiesta di Luca del 20/10/2026 «parti con la
   sicurezza», backlog 30 «Protezione degli accessi»).
   Come funziona:
     - ogni movimento del mouse, tasto, clic, tocco o scorrimento conta
       come attività; l'ora dell'ultima attività è condivisa tra le schede
       dello stesso browser (localStorage), così chi lavora in un'altra
       scheda non viene fatto uscire;
     - dopo TEMPO_STAFF (Operatori e Amministratori: 30 minuti) o
       TEMPO_CLIENTI (utenti degli enti: 60 minuti) senza attività compare
       l'avviso «Sei ancora lì?» con il conto alla rovescia di 2 minuti;
     - «Resto collegato» riparte da zero; allo scadere il portale esce da
       solo (registrato come uscita «per inattività», script 34) e mostra la
       pagina di accesso con la spiegazione.
   Usato da: src/components/Header.jsx (tutte le pagine riservate).
   Nessun dato letto; scrive solo l'uscita tramite esci() di AuthContext.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»; script 34.
   ========================================================================= */
import React, { useEffect, useRef, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { msInattivita, AVVISO_MS } from "../lib/inattivita.js";

const CHIAVE = "cwp_ultima_attivita";
const EVENTI = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];

// Ora dell'ultima attività (la più recente tra questa scheda e le altre).
function leggiUltima(locale) {
  let condivisa = 0;
  try {
    condivisa = Number(localStorage.getItem(CHIAVE)) || 0;
  } catch {
    /* archivio del browser non disponibile: vale solo questa scheda */
  }
  return Math.max(locale, condivisa);
}

/* Componente senza props: legge ruolo ed esci() da useAuth(). Mostra
   l'avviso solo quando serve. */
export default function UscitaInattivita() {
  const { ruolo, esci } = useAuth();
  const limite = msInattivita(ruolo);
  const ultima = useRef(Date.now());
  const [restano, setRestano] = useState(null); // secondi all'uscita (avviso aperto)
  const uscendo = useRef(false);

  // Registra l'attività (al massimo una scrittura ogni 15 secondi).
  useEffect(() => {
    let scritta = 0;
    function attivita() {
      const ora = Date.now();
      ultima.current = ora;
      if (ora - scritta > 15000) {
        scritta = ora;
        try {
          localStorage.setItem(CHIAVE, String(ora));
        } catch {
          /* nessun effetto */
        }
      }
    }
    attivita();
    EVENTI.forEach((e) => window.addEventListener(e, attivita, { passive: true }));
    return () => EVENTI.forEach((e) => window.removeEventListener(e, attivita));
  }, []);

  // Controllo ogni secondo: avviso negli ultimi 2 minuti, poi uscita.
  useEffect(() => {
    const t = setInterval(async () => {
      if (uscendo.current) return;
      const ferma = Date.now() - leggiUltima(ultima.current);
      if (ferma >= limite) {
        uscendo.current = true;
        await esci("inattivita");
        window.location.assign("/login?uscita=inattivita");
      } else if (ferma >= limite - AVVISO_MS) {
        setRestano(Math.ceil((limite - ferma) / 1000));
      } else {
        setRestano(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [limite, esci]);

  if (restano == null) return null;

  // «Resto collegato»: conta come attività anche per le altre schede.
  function resto() {
    const ora = Date.now();
    ultima.current = ora;
    try {
      localStorage.setItem(CHIAVE, String(ora));
    } catch {
      /* nessun effetto */
    }
    setRestano(null);
  }
  const min = Math.floor(restano / 60);
  const sec = String(restano % 60).padStart(2, "0");

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="inattivita-titolo" style={{ position: "fixed", inset: 0, background: "rgba(27,33,24,0.45)", display: "grid", placeItems: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 14, padding: "22px 24px", maxWidth: 400, width: "100%", boxShadow: "0 16px 40px rgba(27,33,24,0.25)" }}>
        <h2 id="inattivita-titolo" style={{ fontFamily: "'Archivo'", fontSize: 18, margin: "0 0 8px" }}>Sei ancora lì?</h2>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 6px", lineHeight: 1.5 }}>
          Per sicurezza, dopo un periodo senza attività il portale chiude la sessione. Le modifiche non salvate andrebbero perse.
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, margin: "10px 0 16px" }}>
          Uscita tra {min}:{sec}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={resto} autoFocus style={{ background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Resto collegato
          </button>
          <button onClick={() => esci()} style={{ background: C.white, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            Esci ora
          </button>
        </div>
      </div>
    </div>
  );
}
