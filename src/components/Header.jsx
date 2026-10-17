import React from "react";
import { COLORI as C, RUOLI } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";

/* Intestazione del portale: loghi in alto a sinistra, utente ed esci a destra. */
export default function Header() {
  const { utente, ruolo, esci, backendPronto } = useAuth();
  const r = ruolo ? RUOLI[ruolo] : null;

  return (
    <header
      style={{
        background: C.white,
        borderBottom: `1px solid ${C.line}`,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      {/* Loghi in piccolo, a sinistra */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img
          src="/loghi/carbonwasteprint.png"
          alt="Carbon WastePrint"
          style={{ height: 68, width: "auto", display: "block" }}
        />
        <div style={{ width: 1, height: 52, background: C.line }} />
        <img
          src="/loghi/fondazione-operate.png"
          alt="Fondazione Operate"
          style={{ height: 52, width: "auto", display: "block" }}
        />
      </div>

      {/* Utente ed esci */}
      {backendPronto && utente && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {r && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: r.color,
                background: r.soft,
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              {r.short}
            </span>
          )}
          <span
            style={{
              fontSize: 12.5,
              color: C.grafite,
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {utente.email}
          </span>
          <button
            onClick={esci}
            style={{
              background: "transparent",
              color: C.grafite,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: "7px 13px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Esci
          </button>
        </div>
      )}
    </header>
  );
}
