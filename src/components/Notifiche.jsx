/* =========================================================================
   Notifiche
   Scopo: campanella delle notifiche interne (requisiti §9) nell'intestazione.
     Mostra il numero delle non lette, apre un elenco a tendina delle ultime
     50 notifiche, segna come lette e porta alla pratica collegata.
   Usato da: Header.jsx (quindi presente in tutte le pagine riservate).
   Chi lo vede: tutti i ruoli autenticati (cliente/Comune, operatore, admin).
   Dati: elencaNotifiche, segnaNotificheLette (src/lib/dati.js) sulla
     tabella notifica (script 09).
   Sicurezza: le notifiche le crea solo il database, con trigger sugli
     eventi della pratica (funzione cwp_notifica, script 09 e 17; email via
     script 12). Le regole RLS fanno leggere a ognuno solo le proprie
     (utente_id = utente collegato) e un trigger permette di modificare
     soltanto il campo «letta». Il browser non può crearne né cambiarne il testo.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { elencaNotifiche, segnaNotificheLette } from "../lib/dati.js";
import { formatoData } from "../lib/date.js";

/* Campanella delle notifiche interne (requisiti §9): conteggio delle non
   lette, elenco a tendina, apertura della pratica collegata.
   Nessuna prop. Ricarica l'elenco ogni 60 secondi (non c'è aggiornamento
   in tempo reale). */
export default function Notifiche() {
  const { ruolo } = useAuth();
  const navigate = useNavigate();
  const [notifiche, setNotifiche] = useState([]);
  const [aperta, setAperta] = useState(false);
  const box = useRef(null);

  // Legge le ultime 50 notifiche dell'utente (le RLS filtrano per utente).
  async function carica() {
    const { data } = await elencaNotifiche();
    setNotifiche(data || []);
  }

  // Primo caricamento e poi ogni minuto; il timer si ferma quando
  // l'intestazione viene smontata (cambio pagina o uscita).
  useEffect(() => {
    carica();
    const t = setInterval(carica, 60000);
    return () => clearInterval(t);
  }, []);

  // Chiude la tendina cliccando fuori.
  useEffect(() => {
    function fuori(e) {
      if (box.current && !box.current.contains(e.target)) setAperta(false);
    }
    document.addEventListener("mousedown", fuori);
    return () => document.removeEventListener("mousedown", fuori);
  }, []);

  const nonLette = notifiche.filter((n) => !n.letta);

  // Clic su una notifica: la segna come letta, chiude la tendina e apre la
  // pratica collegata. Lo staff la apre nel back-office (/pratiche?id=…),
  // il Comune nella sua area (/?id=…).
  async function apri(n) {
    if (!n.letta) await segnaNotificheLette([n.id]);
    setAperta(false);
    await carica();
    if (n.pratica_id) {
      const staff = ruolo === "operatore" || ruolo === "admin";
      navigate(staff ? `/pratiche?id=${n.pratica_id}` : `/?id=${n.pratica_id}`);
    }
  }

  // «Segna tutte come lette»: solo quelle non lette ora in elenco.
  async function tutteLette() {
    await segnaNotificheLette(nonLette.map((n) => n.id));
    carica();
  }

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button
        onClick={() => setAperta((a) => !a)}
        aria-label={`Notifiche: ${nonLette.length} non lette`}
        aria-expanded={aperta}
        style={{
          position: "relative",
          background: "transparent",
          border: `1px solid ${C.line}`,
          borderRadius: 8,
          width: 36,
          height: 34,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.grafite} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {nonLette.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: C.red,
              color: C.white,
              fontSize: 10.5,
              fontWeight: 700,
              borderRadius: 999,
              minWidth: 18,
              height: 18,
              display: "grid",
              placeItems: "center",
              padding: "0 4px",
            }}
          >
            {nonLette.length > 99 ? "99+" : nonLette.length}
          </span>
        )}
      </button>

      {aperta && (
        <div
          role="dialog"
          aria-label="Notifiche"
          style={{
            position: "absolute",
            right: 0,
            top: 42,
            width: "min(380px, calc(100vw - 32px))",
            maxHeight: 440,
            overflowY: "auto",
            background: C.white,
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(27,33,24,0.14)",
            zIndex: 40,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${C.line}` }}>
            <b style={{ fontSize: 13.5 }}>Notifiche</b>
            {nonLette.length > 0 && (
              <button onClick={tutteLette} style={{ background: "none", border: "none", color: C.green, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Segna tutte come lette
              </button>
            )}
          </div>
          {notifiche.length === 0 && (
            <div style={{ padding: "18px 14px", fontSize: 13, color: C.grafite }}>Nessuna notifica.</div>
          )}
          {notifiche.map((n) => (
            <button
              key={n.id}
              onClick={() => apri(n)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: n.letta ? C.white : C.greenSoft,
                border: "none",
                borderBottom: `1px solid ${C.line}`,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: n.letta ? 500 : 700, color: C.ink }}>{n.titolo}</div>
              {n.testo && <div style={{ fontSize: 12, color: C.grafite, marginTop: 2 }}>{n.testo}</div>}
              <div style={{ fontSize: 11, color: C.grafite, marginTop: 3 }}>{formatoData(n.creato_il)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
