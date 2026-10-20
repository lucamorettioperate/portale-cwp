/* =========================================================================
   Verifica a due fattori (MFA) — nessun indirizzo proprio: la mostra
   Protetta in src/App.jsx al posto di qualsiasi pagina protetta quando
   mfa.richiesta è vero e mfa.verificata è falso.
   Scopo: (requisiti §13)
     - primo accesso: attivazione con QR code da inquadrare con un'app di
       autenticazione (Google Authenticator, Microsoft Authenticator, Authy…),
       con chiave da inserire a mano in alternativa;
     - accessi successivi: codice a 6 cifre generato dall'app.
   Chi la usa: Operatori e Amministratori, solo se l'interruttore
     mfa_obbligatoria è acceso (oggi spento: vedi Registro).
   Dati: Supabase Auth MFA (listFactors, unenroll, enroll,
     challengeAndVerify) direttamente da src/lib/supabase.js; poi
     caricaMfa() di AuthContext (RPC mio_stato_mfa, script 10).
   Sicurezza: la protezione vera è nel database. Senza sessione «aal2» la
     funzione app_is_staff() restituisce falso (script 10) e lo staff non ha
     alcun potere del back-office, anche aggirando questa pagina. La pagina
     serve solo a portare la sessione da aal1 ad aal2.
   Registro sviluppo e deploy: capitolo «Portale (frontend)» (interruttore
     di emergenza MFA nel capitolo «Database»).
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";

/* Schermata di verifica. Nessuna prop.
   All'apertura capisce se l'utente ha già un fattore TOTP verificato
   (chiede solo il codice) oppure no (avvia una nuova attivazione con QR).
   Dopo un codice corretto aggiorna lo stato MFA del contesto: App.jsx
   mostra allora la pagina richiesta. */
export default function VerificaMfa() {
  const { esci, caricaMfa, utente } = useAuth();
  const [fattore, setFattore] = useState(null); // fattore TOTP verificato
  const [attivazione, setAttivazione] = useState(null); // { id, qr, segreto }
  const [codice, setCodice] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [pronto, setPronto] = useState(false);

  // Preparazione, una volta all'apertura: lettura dei fattori esistenti ed
  // eventuale avvio dell'attivazione.
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setErrore("Impossibile leggere la configurazione: " + error.message);
        setPronto(true);
        return;
      }
      const verificato = (data?.totp || []).find((f) => f.status === "verified");
      if (verificato) {
        setFattore(verificato);
      } else {
        // Rimuove eventuali attivazioni lasciate a metà, poi ne avvia una nuova.
        for (const f of data?.all || []) {
          if (f.factor_type === "totp" && f.status !== "verified") {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
        }
        // Il nome con la data distingue i dispositivi nell'elenco dei fattori.
        // qr_code è un'immagine (data URL) pronta per <img>.
        const { data: nuovo, error: e2 } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Portale CWP ${new Date().toISOString().slice(0, 10)}`,
        });
        if (e2) setErrore("Attivazione non avviata: " + e2.message);
        else setAttivazione({ id: nuovo.id, qr: nuovo.totp.qr_code, segreto: nuovo.totp.secret });
      }
      setPronto(true);
    })();
  }, []);

  // Invio del codice. Vale sia per un fattore già attivo sia per quello in
  // attivazione: una verifica riuscita completa l'attivazione e porta la
  // sessione a livello aal2.
  async function verifica(e) {
    e.preventDefault();
    setErrore("");
    // Spazi tolti: l'app può mostrare il codice come «123 456» (maxLength 7).
    const pulito = codice.replace(/\s/g, "");
    if (!/^\d{6}$/.test(pulito)) {
      setErrore("Il codice è di 6 cifre.");
      return;
    }
    setInCorso(true);
    const factorId = fattore ? fattore.id : attivazione.id;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: pulito });
    setInCorso(false);
    if (error) {
      setErrore("Codice non valido o scaduto. Riprova con il codice attuale dell'app.");
      setCodice("");
      return;
    }
    // Rilegge mio_stato_mfa: con verificata = true App.jsx lascia passare.
    await caricaMfa();
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.paper, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 26px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 20, margin: "0 0 6px" }}>Verifica a due fattori</h1>
        <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 18px", lineHeight: 1.55 }}>
          Per Operatori e Amministratori l'accesso richiede, oltre alla password, un codice generato da
          un'app di autenticazione sul telefono.
        </p>

        {!pronto && <div style={{ color: C.grafite, fontSize: 13 }}>Preparazione…</div>}

        {pronto && attivazione && (
          <div style={{ marginBottom: 16 }}>
            <ol style={{ fontSize: 13, color: C.ink, paddingLeft: 18, margin: "0 0 12px", lineHeight: 1.6 }}>
              <li>Installa un'app di autenticazione (Google Authenticator, Microsoft Authenticator, Authy…).</li>
              <li>Nell'app scegli «Aggiungi account» e inquadra il QR code.</li>
              <li>Scrivi qui sotto il codice a 6 cifre che compare nell'app.</li>
            </ol>
            <div style={{ display: "grid", placeItems: "center", padding: 12, border: `1px solid ${C.line}`, borderRadius: 12, background: "#fff" }}>
              <img src={attivazione.qr} alt="QR code da inquadrare con l'app di autenticazione" width="190" height="190" />
            </div>
            <details style={{ fontSize: 12, color: C.grafite, marginTop: 8 }}>
              <summary style={{ cursor: "pointer" }}>Non riesci a inquadrare il codice?</summary>
              <div style={{ marginTop: 6 }}>
                Inserisci a mano questa chiave nell'app:
                <div style={{ fontFamily: "monospace", fontSize: 13, wordBreak: "break-all", background: C.paper, padding: "6px 8px", borderRadius: 6, marginTop: 4 }}>
                  {attivazione.segreto}
                </div>
              </div>
            </details>
          </div>
        )}

        {pronto && (fattore || attivazione) && (
          <form onSubmit={verifica}>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600, color: C.grafite }}>
              Codice a 6 cifre
              <input
                value={codice}
                onChange={(e) => setCodice(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={7}
                placeholder="123456"
                style={{ padding: "11px 12px", border: `1px solid ${C.line}`, borderRadius: 9, fontSize: 20, letterSpacing: 4, fontFamily: "monospace", textAlign: "center" }}
              />
            </label>
            {errore && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{errore}</div>}
            <button
              type="submit"
              disabled={inCorso}
              style={{ width: "100%", marginTop: 14, background: C.green, color: C.white, border: "none", borderRadius: 9, padding: "11px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              {inCorso ? "Verifica…" : attivazione ? "Attiva e accedi" : "Accedi"}
            </button>
          </form>
        )}

        {pronto && !fattore && !attivazione && errore && <div style={{ color: C.red, fontSize: 13 }}>{errore}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, fontSize: 12, color: C.grafite }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{utente?.email}</span>
          <button onClick={() => esci()} style={{ background: "none", border: "none", color: C.grafite, textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}
