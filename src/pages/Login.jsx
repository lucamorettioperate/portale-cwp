import React, { useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";

/* Pagina di accesso — email e password. */
export default function Login() {
  const { accedi, backendPronto } = useAuth();
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 9,
              background: C.green,
              display: "grid",
              placeItems: "center",
              fontFamily: "'Archivo'",
              fontWeight: 800,
              fontSize: 17,
              color: C.white,
            }}
          >
            CW
          </div>
          <div style={{ fontFamily: "'Archivo'", fontWeight: 800, fontSize: 18 }}>
            Carbon WastePrint<span style={{ color: C.amber }}>®</span>
          </div>
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
        </form>
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
