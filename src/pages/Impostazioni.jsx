/* =========================================================================
   Impostazioni — indirizzo «/impostazioni»
   Scopo: parametri del Programma modificabili dagli Amministratori:
     - Durata delle fasi del Progetto e del Rapporto di Monitoraggio
       (script 13 e 21, componente DurateFasi);
     - Documenti richiesti per fase (script 21, componente
       DocumentiRichiesti);
     - Modelli di documento per i Comuni (script 17, componente
       ModelliDocumento).
   Gli Enti di Validazione si gestiscono nella pagina Anagrafiche
   (/anagrafiche), aperta anche agli Operatori (script 21).
   Chi la usa: solo Amministratori (gli altri vedono un messaggio).
   Dati: ogni sezione ha i propri accessi ai dati nel componente.
   Sicurezza: le regole sono nel database (vedi i singoli componenti); il
     controllo del ruolo qui serve solo a non mostrare la pagina.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import DurateFasi from "../components/impostazioni/DurateFasi.jsx";
import DocumentiRichiesti from "../components/impostazioni/DocumentiRichiesti.jsx";
import ModelliDocumento from "../components/impostazioni/ModelliDocumento.jsx";

/* Pagina delle impostazioni. Nessuna prop. */
export default function Impostazioni() {
  const { ruolo } = useAuth();

  if (ruolo !== "admin") {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: C.grafite }}>
          Questa sezione è riservata agli amministratori.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Impostazioni</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 18px" }}>
          Parametri del Programma Carbon WastePrint modificabili dagli amministratori.
        </p>
        <DurateFasi tipo="progetto" />
        <DurateFasi tipo="rapporto" />
        <DocumentiRichiesti />
        <ModelliDocumento />
      </main>
    </div>
  );
}
