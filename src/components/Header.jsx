/* =========================================================================
   Header
   Scopo: intestazione in cima a ogni pagina riservata. A sinistra i loghi
     (Carbon WastePrint, Fondazione Operate, RINA, Carbon Credit) con
     collegamento alla pagina iniziale; a destra, se l'utente ha fatto
     l'accesso: menu per ruolo, campanella delle notifiche, etichetta del
     ruolo, collegamento al profilo e pulsante «Esci».
   Usato da: pagine AreaCliente, BackOffice, Cruscotto, TuoiDocumenti,
     GestioneUtenti, Audit, Crediti, CalcoloCrediti, Impostazioni,
     Documentazione, Profilo, CambiaPassword.
   Chi lo vede: tutti i ruoli autenticati (cliente/Comune, operatore,
     admin). Senza accesso si vedono solo i loghi.
   Dati: useAuth() (src/lib/AuthContext.jsx) per utente, ruolo ed esci();
     RUOLI e COLORI da src/lib/cwpProgram.js. Le notifiche le legge il
     componente Notifiche.
   Sicurezza: il menu per ruolo è solo interfaccia (nasconde le voci che
     non servono). Il vero controllo è in App.jsx (rotte protette), nelle
     pagine e soprattutto nel database (RLS e funzioni): un utente che
     digita a mano un indirizzo Admin non vede comunque dati non suoi.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { COLORI as C, RUOLI } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Notifiche from "./Notifiche.jsx";

// Voci di menu per ruolo: elenco di coppie [indirizzo, etichetta].
// Qualunque ruolo diverso da admin e operatore (compreso un profilo
// senza ruolo) riceve il menu del cliente/Comune.
// Se si aggiunge una pagina in App.jsx, aggiungere qui la voce del ruolo.
function vociMenu(ruolo) {
  if (ruolo === "admin") {
    return [
      ["/", "Cruscotto"],
      ["/pratiche", "Pratiche"],
      ["/utenti", "Utenti"],
      ["/audit", "Audit"],
      ["/anagrafiche", "Anagrafiche"],
      ["/crediti", "Calcolo crediti"],
      ["/crediti-emessi", "Crediti emessi"],
      ["/reclami", "Reclami"],
      ["/impostazioni", "Impostazioni"],
      ["/documentazione", "Documentazione"],
    ];
  }
  if (ruolo === "operatore") {
    return [
      ["/", "Cruscotto"],
      ["/pratiche", "Pratiche"],
      ["/anagrafiche", "Anagrafiche"],
      ["/crediti-emessi", "Crediti emessi"],
      ["/reclami", "Reclami"],
      ["/documentazione", "Manuale"],
    ];
  }
  return [
    ["/", "Le mie pratiche"],
    ["/documenti", "I tuoi documenti"],
    ["/formato-dati", "Formato dati"],
    ["/reclami", "Reclami"],
    ["/programma", "Il Programma"],
    ["/documentazione", "Manuale"],
  ];
}

/* Intestazione del portale: loghi a sinistra; menu, notifiche, utente ed
   esci a destra. Nessuna prop: legge tutto da useAuth() e dall'indirizzo
   corrente (per evidenziare la voce di menu attiva). */
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
      <Link to="/" className="loghi-header" aria-label="Pagina iniziale">
        <img className="logo-cwp" src="/loghi/carbonwasteprint.png" alt="Carbon WastePrint" />
        <div className="loghi-separatore" />
        <div className="loghi-colonna">
          <img className="logo-fondazione" src="/loghi/fondazione-operate.png" alt="Fondazione Operate" />
          <div className="loghi-partner">
            <img src="/loghi/rina.png" alt="RINA — Certification Digital Partner" />
            <img src="/loghi/carbon-credit.svg" alt="Carbon Credit" />
          </div>
        </div>
      </Link>

      {backendPronto && utente && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <nav aria-label="Menu principale" style={{ display: "flex", gap: 4, marginRight: 4, flexWrap: "wrap" }}>
            {vociMenu(ruolo).map(([to, label]) => {
              // "/" è attiva solo sulla pagina iniziale esatta (altrimenti
              // sarebbe sempre evidenziata); le altre anche sulle sottopagine
              // (es. /crediti/123 evidenzia «Calcolo crediti»).
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
          <Link
            to="/profilo"
            title="Il mio profilo: password e manuali"
            style={{ fontSize: 12.5, color: C.grafite, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}
          >
            {utente.email}
            <span style={{ display: "block", fontSize: 11, color: C.green, fontWeight: 600 }}>Il mio profilo</span>
          </Link>
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
