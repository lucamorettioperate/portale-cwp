import React from "react";
import { Link, useLocation } from "react-router-dom";
import { COLORI as C, RUOLI } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Notifiche from "./Notifiche.jsx";

// Voci di menu per ruolo.
function vociMenu(ruolo) {
  if (ruolo === "admin") {
    return [
      ["/", "Cruscotto"],
      ["/pratiche", "Pratiche"],
      ["/utenti", "Utenti"],
      ["/audit", "Audit"],
      ["/crediti", "Crediti CWP"],
    ];
  }
  if (ruolo === "operatore") {
    return [
      ["/", "Cruscotto"],
      ["/pratiche", "Pratiche"],
    ];
  }
  return [
    ["/", "Le mie pratiche"],
    ["/documenti", "I tuoi documenti"],
  ];
}

/* Intestazione del portale: loghi a sinistra; menu, notifiche, utente ed
   esci a destra. */
export default function Header() {
  const { utente, ruolo, esci, backendPronto } = useAuth();
  const r = ruolo ? RUOLI[ruolo] : null;
  const location = useLocation();

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
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: 16 }} aria-label="Pagina iniziale">
        <img src="/loghi/carbonwasteprint.png" alt="Carbon WastePrint" style={{ height: 68, width: "auto", display: "block" }} />
        <div style={{ width: 1, height: 52, background: C.line }} />
        <img src="/loghi/fondazione-operate.png" alt="Fondazione Operate" style={{ height: 52, width: "auto", display: "block" }} />
      </Link>

      {backendPronto && utente && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <nav aria-label="Menu principale" style={{ display: "flex", gap: 4, marginRight: 4, flexWrap: "wrap" }}>
            {vociMenu(ruolo).map(([to, label]) => {
              const attiva = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={attiva ? "page" : undefined}
                  style={{
                    textDecoration: "none",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: attiva ? C.green : C.grafite,
                    padding: "6px 10px",
                    borderRadius: 7,
                    background: attiva ? C.greenSoft : "transparent",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <Notifiche />
          {r && (
            <span style={{ fontSize: 11, fontWeight: 600, color: r.color, background: r.soft, padding: "4px 10px", borderRadius: 999 }}>
              {r.short}
            </span>
          )}
          <span style={{ fontSize: 12.5, color: C.grafite, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
