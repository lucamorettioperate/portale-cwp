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
   Telefono (fino a 760 px, richiesta di Luca del 22/10/2026): sotto i
     loghi più piccoli restano solo la campanella e il pulsante «Menu», che
     apre un pannello con le voci grandi da toccare, il profilo ed «Esci».
     Il pannello si chiude cambiando pagina, con Esc o con «Chiudi». Su
     computer l'intestazione resta com'era. Le regole sono in global.css
     (classi header-*).
   Sicurezza: il menu per ruolo è solo interfaccia (nasconde le voci che
     non servono). Il vero controllo è in App.jsx (rotte protette), nelle
     pagine e soprattutto nel database (RLS e funzioni): un utente che
     digita a mano un indirizzo Admin non vede comunque dati non suoi.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { COLORI as C, RUOLI } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Notifiche from "./Notifiche.jsx";
import AssistenteVirtuale from "./AssistenteVirtuale.jsx";
import { IndicatoreOnline, SegnalaPresenza, usePrincipale } from "./UtentiOnline.jsx";
import UscitaInattivita from "./UscitaInattivita.jsx";
import { notizieNuove } from "../lib/dati.js";
import { useTelefono } from "../lib/useTelefono.js";

// Notizie CO2 nuove per il pallino verde del menu (solo Amministratori,
// script 37): si legge all'apertura, a ogni cambio di pagina e ogni 2
// minuti; la pagina Notizie CO2 lo spegne con l'evento «cwp-notizie-viste».
function useNotizieNuove(attivo, percorso) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!attivo) return undefined;
    let vivo = true;
    const leggi = () => notizieNuove().then(({ data }) => vivo && setN(Number(data) || 0)).catch(() => {});
    leggi();
    const t = setInterval(leggi, 120000);
    const spegni = () => setN(0);
    window.addEventListener("cwp-notizie-viste", spegni);
    return () => {
      vivo = false;
      clearInterval(t);
      window.removeEventListener("cwp-notizie-viste", spegni);
    };
  }, [attivo, percorso]);
  return n;
}

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
      // Comuni, gestori e campagne email (23/10/2026, script 44).
      ["/marketing", "Marketing"],
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
  const notizie = useNotizieNuove(!!utente && ruolo === "admin", location.pathname);
  const telefono = useTelefono();
  // Pannello del menu sul telefono: si chiude a ogni cambio di pagina e con Esc.
  const [menuAperto, setMenuAperto] = useState(false);
  useEffect(() => { setMenuAperto(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!menuAperto) return undefined;
    const esc = (e) => { if (e.key === "Escape") setMenuAperto(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [menuAperto]);
  const voci = backendPronto && utente ? vociMenu(ruolo, principale) : [];
  const attivaDi = (to) => (to === "/" ? location.pathname === "/" : location.pathname === to || location.pathname.startsWith(to + "/"));
  const pallino = (to, attiva) => to === "/notizie-co2" && notizie > 0 && !attiva;

  return (
    <header className="header-portale" style={{ background: C.white, borderBottom: `1px solid ${C.line}` }}>
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

      {/* Telefono: campanella e pulsante «Menu» accanto ai loghi. */}
      {backendPronto && utente && telefono && (
        <div className="header-telefono">
          <Notifiche />
          <button
            onClick={() => setMenuAperto((a) => !a)}
            aria-expanded={menuAperto}
            aria-controls="menu-telefono"
            className="header-pulsante-menu"
          >
            <span aria-hidden="true" className="header-icona-menu">{menuAperto ? "✕" : "☰"}</span>
            {menuAperto ? "Chiudi" : "Menu"}
            {voci.some(([to]) => pallino(to, attivaDi(to))) && <span className="header-pallino" aria-label="Notizie CO2 nuove" />}
          </button>
        </div>
      )}

      {/* Telefono: pannello del menu, a tutta larghezza sotto i loghi. */}
      {backendPronto && utente && telefono && menuAperto && (
        <nav id="menu-telefono" aria-label="Menu principale" className="header-pannello">
          {voci.map(([to, label]) => {
            if (!to) return <span key={label} aria-disabled="true" className="header-voce header-voce-spenta">{label} · in arrivo</span>;
            const attiva = attivaDi(to);
            return (
              <Link key={to} to={to} aria-current={attiva ? "page" : undefined} className={"header-voce" + (attiva ? " header-voce-attiva" : "")}>
                {label}
                {pallino(to, attiva) && <span className="header-pallino-voce">{notizie} {notizie === 1 ? "nuova" : "nuove"}</span>}
              </Link>
            );
          })}
          <div className="header-pannello-utente">
            <Link to="/profilo" className="header-voce">
              <span style={{ display: "block", fontSize: 12, color: C.grafite, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{utente.email}</span>
              Il mio profilo {r && <span style={{ fontSize: 11, fontWeight: 600, color: r.color, background: r.soft, padding: "3px 9px", borderRadius: 999, marginLeft: 6 }}>{r.short}</span>}
            </Link>
            <IndicatoreOnline />
            <button onClick={() => esci()} className="header-voce header-esci">Esci</button>
          </div>
        </nav>
      )}

      {backendPronto && utente && !telefono && (
        <div className="header-computer">
          <nav aria-label="Menu principale" style={{ display: "flex", gap: 4, marginRight: 4, flexWrap: "wrap" }}>
            {voci.map(([to, label]) => {
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
              const attiva = attivaDi(to);
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
                    position: "relative",
                  }}
                >
                  {label}
                  {/* Pallino verde: notizie CO2 nuove dall'ultima visita (21/10/2026). */}
                  {pallino(to, attiva) && (
                    <span
                      title={`${notizie} ${notizie === 1 ? "notizia nuova" : "notizie nuove"}`}
                      aria-label={`${notizie} notizie nuove`}
                      style={{ position: "absolute", top: 1, right: 1, width: 8, height: 8, borderRadius: "50%", background: "#2fb24c", boxShadow: "0 0 0 2px #fff, 0 0 4px rgba(47,178,76,0.7)" }}
                    />
                  )}
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
