/* =========================================================================
   AzioniRuolo
   Scopo: pulsanti di azione del prototipo, diversi per ruolo (promotore,
     operate, validatore), con il pulsante «avanza fase» attivo solo quando
     tocca a quel ruolo.
   Usato da: nessun file. Non usato: resto del prototipo, si può eliminare.
     Usa ruoli e campi del prototipo (promotore/operate/validatore, ATTORI,
     f.attore, f.titolo) che non esistono più: i ruoli reali sono cliente,
     operatore, admin e le azioni vere stanno in DettaglioPratica.jsx.
   Chi lo vede: nessuno (non montato in alcuna pagina).
   Dati: nessuno dal database; solo costanti di src/lib/cwpProgram.js.
   Sicurezza: nessuna; era solo interfaccia dimostrativa.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React from "react";
import { FASI, ATTORI, COLORI as C } from "../lib/cwpProgram.js";

// Azioni contestuali in base al ruolo e alla fase corrente della pratica.
// Props: ruolo (del prototipo), progetto (con faseCorrente e stato),
// onAvanza (chiamata dal pulsante «→» quando è il turno del ruolo).
export default function AzioniRuolo({ ruolo, progetto, onAvanza }) {
  const fase = FASI[progetto.faseCorrente - 1];
  // Nessuna fase corrente o progetto già validato: solo il messaggio finale.
  if (!fase || progetto.stato === "Validato") {
    return (
      <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
        ✓ Progetto validato — monitoraggio annuale attivo
      </div>
    );
  }

  // È il turno del ruolo se è il responsabile della fase (Operate sempre).
  const spettaA = fase.attore;
  const mioTurno =
    (ruolo === "promotore" && spettaA === "promotore") ||
    (ruolo === "validatore" && spettaA === "validatore") ||
    ruolo === "operate"; // Operate sovrintende sempre

  // Etichette dei pulsanti per ruolo; quelle con «→» fanno avanzare la fase.
  const azioni = {
    promotore: ["Carica documentazione", "Aggiorna rapporto conferimenti", "Avanza fase →"],
    operate: ["Verifica documentale", "Richiedi integrazioni", "Approva e avanza →"],
    validatore: ["Avvia validazione", "Emetti rapporto di validazione", "Conferma esito →"],
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: C.grafite, marginBottom: 10 }}>
        Fase corrente: <b style={{ color: C.ink }}>{fase.titolo}</b> · responsabile{" "}
        <b style={{ color: ATTORI[fase.attore].color }}>{ATTORI[fase.attore].short}</b>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {azioni[ruolo].map((a, i) => {
          const isAvanza = a.includes("→");
          return (
            <button
              key={i}
              disabled={isAvanza && !mioTurno}
              onClick={isAvanza && mioTurno ? onAvanza : undefined}
              style={{
                background: isAvanza ? (mioTurno ? C.green : C.line) : C.white,
                color: isAvanza ? C.white : C.ink,
                border: `1px solid ${isAvanza ? (mioTurno ? C.green : C.line) : C.line}`,
                borderRadius: 8,
                padding: "9px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: isAvanza && !mioTurno ? "not-allowed" : "pointer",
              }}
            >
              {a}
            </button>
          );
        })}
      </div>
      {!mioTurno && (
        <div style={{ fontSize: 11.5, color: C.amber, marginTop: 10 }}>
          In attesa dell'azione di {ATTORI[fase.attore].short} per questa fase.
        </div>
      )}
    </div>
  );
}
