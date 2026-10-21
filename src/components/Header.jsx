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
     componente Notifiche. Per Amministratori e utenti degli enti mostra
     anche il pulsante dell'assistente virtuale (AssistenteVirtuale), fisso
     in basso a destra. Per tutti segnala la presenza (SegnalaPresenza) e,
     solo all'Amministratore principale, mostra «n online»
     (IndicatoreOnline, src/components/UtentiOnline.jsx).
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
import AssistenteVirtuale from "./AssistenteVirtuale.jsx";
import { IndicatoreOnline, SegnalaPresenza, usePrincipale } from "./UtentiOnline.jsx";
import UscitaInattivita from "./UscitaInattivita.jsx";

// Voci di menu per ruolo: elenco di coppie [indirizzo, etichetta].
// Qualunque ruolo diverso da admin e operatore (compreso un profilo
// senza ruolo) riceve il menu del cliente/Comune.
// Se si aggiunge una pagina in App.jsx, aggiungere qui la voce del ruolo.
// principale: vero per l'Amministratore principale, che ha in più la voce
// «Audit User» (/audit-utenti, script 33).
// Una voce senza indirizzo ([null, "nome"]) è una sezione in arrivo: si
// vede in grigio e non è cliccabile (es. «Marketplaces», richiesta di Luca
// del 20/10/2026, per Amministratori e utenti degli enti).
function vociMenu(ruolo, principale = false) {
  if (ruolo === "admin") {
    // Ordine scelto da Luca il 20/10/2026.
    return [
      ["/", "Dashboard"],
      ["/anagrafiche", "Anagrafiche"],
      ["/simulatore", "Simulatore"],
      ["/pratiche", "Pratiche"],
      ["/reclami", "Reclami"],
      ["/crediti", "Calcolo crediti"],
      ["/crediti-emessi", "Crediti emessi"],
      ["/impostazioni", "Impostazioni"],
      ["/utenti", "Utenti"],
      ["/audit", "Audit"],
      ...(principale ? [["/audit-utenti", "Audit User"]] : []),
      ["/documentazione", "Documentazione"],
      // Osservatorio sui crediti di carbonio volontari (21/10/2026, script 36;
      // «News» rinominato «Notizie CO2» su richiesta di Luca).
      ["/notizie-co2", "Notizie CO2"],
      [null, "Marketplaces"],
    ];
  }
  if (ruolo === "operatore") {
    return [
      ["/", "Dashboard"],
      ["/pratiche", "Pratiche"],
      ["/anagrafiche", "Anagrafiche"],
      ["/simulatore", "Simulatore"],
      ["/crediti-emessi", "Crediti emessi"],
      ["/reclami", "Reclami"],
      ["/documentazione", "Manuale"],
    ];
  }
  // Utenti degli enti: ordine ed etichette scelti da Luca il 20/10/2026.
  return [
    ["/", "Le mie pratiche"],
    ["/documenti", "I tuoi documenti"],
    ["/reclami", "Reclami"],
    ["/formato-dati", "Formato dati"],
    ["/programma", "Il Programma CWP"],
    ["/documentazione", "Manuali"],
    [null, "Marketplaces"],
  ];
}

/* Intestazione del portale: loghi a sinistra; menu, notifiche, utente ed
   esci a destra. Nessuna prop: legge tutto da useAuth() e dall'indirizzo
   corrente (per evidenziare la voce di menu attiva). */
export default function Header() {
  const { utente, ruolo, esci, backendPronto, passwordDaCambiare } = useAuth();
  const r = ruolo ? RUOLI[ruolo] : null;
  const location = useLocation();
  const principale = usePrincipale();

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
            {/* RINA un po' più alto: nel file il cerchio occupa l'88% dell'altezza
                (in alto sporgono i quadratini), nel Carbon Credit il 96%; così i
                due cerchi risultano uguali (21/10/2026). */}
            <img className="logo-rina" src="/loghi/rina.png" alt="RINA — Certification Digital Partner" />
            <img className="logo-carbon-credit" src="/loghi/carbon-credit.svg" alt="Carbon Credit" />
          </div>
        </div>
      </Link>

      {backendPronto && utente && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <nav aria-label="Menu principale" style={{ display: "flex", gap: 4, marginRight: 4, flexWrap: "wrap" }}>
            {vociMenu(ruolo, principale).map(([to, label]) => {
              // Sezione in arrivo: testo grigio, non cliccabile.
              if (!to) {
                return (
                  <span
                    key={label}
                    aria-disabled="true"
                    title="In arrivo"
                    style={{ fontSize: 12.5, fontWeight: 600, color: "#a9ada3", padding: "6px 10px", borderRadius: 7, cursor: "not-allowed", userSelect: "none" }}
                  >
                    {label}
                  </span>
                );
              }
              // "/" è attiva solo sulla pagina iniziale esatta (altrimenti
              // sarebbe sempre evidenziata); le altre anche sulle sottopagine
              // (es. /crediti/123 evidenzia «Calcolo crediti»), ma /audit non si
              // accende su /audit-utenti.
              const attiva = to === "/" ? location.pathname === "/" : location.pathname === to || location.pathname.startsWith(to + "/");
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
          <IndicatoreOnline />
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
            onClick={() => esci()}
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
      {/* Presenza per «Utenti online» (script 32): tutti gli utenti attivi. */}
      {backendPronto && utente && <SegnalaPresenza pagina={location.pathname} />}
      {/* Uscita automatica dopo un periodo senza attività (script 34). */}
      {backendPronto && utente && <UscitaInattivita />}
      {/* Assistente virtuale (Claude): per ora Amministratori ed enti. */}
      {backendPronto && utente && !passwordDaCambiare && (ruolo === "admin" || ruolo === "operatore" || ruolo === "cliente") && <AssistenteVirtuale ruolo={ruolo} />}
    </header>
  );
}
