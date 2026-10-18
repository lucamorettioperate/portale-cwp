import React, { useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";

/* Pagina di accesso — email e password. */
export default function Login() {
  const { accedi, backendPronto, richiediRecuperoPassword } = useAuth();
  // "Password dimenticata?": null = modulo di accesso; "modulo"; "inviata".
  const [recupero, setRecupero] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErrore("");
    setInCorso(true);
    const { error } = await accedi(email.trim(), password);
    setInCorso(false);
    if (error) {
      setErrore(
        error.message?.includes("Invalid login")
          ? "Email o password non corretti."
          : "Accesso non riuscito. Riprova."
      );
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: C.paper,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: C.white,
          border: `1px solid ${C.line}`,
          borderRadius: 16,
          padding: "32px 28px",
        }}
      >
        <img
          src="/loghi/carbonwasteprint.png"
          alt="Carbon WastePrint"
          style={{ height: 96, width: "auto", display: "block", marginBottom: 14 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.grafite }}>Programma di</span>
          <img
            src="/loghi/fondazione-operate.png"
            alt="Fondazione Operate"
            style={{ height: 40, width: "auto", display: "block" }}
          />
        </div>
        <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 24px" }}>
          Accedi alla piattaforma di gestione del Programma.
        </p>

        {!backendPronto && (
          <div
            style={{
              background: C.ocraSoft,
              border: `1px solid ${C.amber}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 12.5,
              marginBottom: 16,
            }}
          >
            Backend non configurato in questo ambiente.
          </div>
        )}

        {recupero && (
          <RecuperoPassword
            emailIniziale={email}
            stato={recupero}
            onInviata={() => setRecupero("inviata")}
            onAnnulla={() => setRecupero(null)}
            richiedi={richiediRecuperoPassword}
          />
        )}
        {!recupero && (
        <form onSubmit={onSubmit}>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              style={campoStyle}
            />
          </label>
          <label style={{ display: "block", marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={campoStyle}
            />
          </label>

          {errore && (
            <div style={{ color: C.red, fontSize: 13, marginBottom: 14 }}>{errore}</div>
          )}

          <button
            type="submit"
            disabled={inCorso}
            style={{
              width: "100%",
              background: C.green,
              color: C.white,
              border: "none",
              borderRadius: 9,
              padding: "12px",
              fontSize: 14,
              fontWeight: 700,
              cursor: inCorso ? "default" : "pointer",
              opacity: inCorso ? 0.7 : 1,
            }}
          >
            {inCorso ? "Accesso in corso…" : "Accedi"}
          </button>
          <button
            type="button"
            onClick={() => setRecupero("modulo")}
            style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: C.green, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Password dimenticata?
          </button>
        </form>
        )}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.grafite }}>
          Comuni e gestori: <a href="/formato-dati" style={{ color: C.green, fontWeight: 600 }}>formato dei dati per il calcolo dei crediti</a>
          {" · "}
          <a href="/manuali/Manuale_Utente_Portale_CWP.pdf" target="_blank" rel="noreferrer" style={{ color: C.green, fontWeight: 600 }}>manuale utente (PDF)</a>
        </div>
      </div>
    </div>
  );
}

const campoStyle = {
  width: "100%",
  marginTop: 5,
  padding: "11px 12px",
  border: "1px solid #d9d4c5",
  borderRadius: 9,
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  boxSizing: "border-box",
};

/* Richiesta del collegamento per reimpostare la password. Il messaggio di
   conferma è lo stesso che l'indirizzo esista o no (non si rivela chi è
   registrato). */
function RecuperoPassword({ emailIniziale, stato, onInviata, onAnnulla, richiedi }) {
  const [email, setEmail] = useState(emailIniziale || "");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState("");

  async function invia(e) {
    e.preventDefault();
    setErrore("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErrore("Inserisci un indirizzo email valido.");
    setInCorso(true);
    const { error } = await richiedi(email.trim());
    setInCorso(false);
    if (error && /rate limit|too many|seconds/i.test(error.message || "")) {
      return setErrore("Troppe richieste ravvicinate: riprova tra qualche minuto.");
    }
    onInviata();
  }

  if (stato === "inviata") {
    return (
      <div>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Controlla la tua email</h2>
        <p style={{ fontSize: 13.5, color: C.grafite, lineHeight: 1.5, margin: "0 0 16px" }}>
          Se l'indirizzo <b>{email.trim()}</b> è registrato nel portale, riceverai a breve un'email con il collegamento per
          scegliere una nuova password. Il collegamento vale una sola volta. Se non arriva, controlla la posta indesiderata
          o scrivi a Fondazione Operate.
        </p>
        <button type="button" onClick={onAnnulla} style={{ background: "none", border: "none", color: C.green, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
          ← Torna all'accesso
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={invia}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Password dimenticata</h2>
      <p style={{ fontSize: 13.5, color: C.grafite, lineHeight: 1.5, margin: "0 0 14px" }}>
        Inserisci l'email con cui accedi: ti invieremo un collegamento per scegliere una nuova password.
      </p>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required style={campoStyle} />
      </label>
      {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 14 }}>{errore}</div>}
      <button type="submit" disabled={inCorso} style={{ width: "100%", background: C.green, color: C.white, border: "none", borderRadius: 9, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: inCorso ? 0.7 : 1 }}>
        {inCorso ? "Invio…" : "Invia il collegamento"}
      </button>
      <button type="button" onClick={onAnnulla} style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: C.grafite, fontSize: 13, cursor: "pointer" }}>
        Annulla
      </button>
    </form>
  );
}
