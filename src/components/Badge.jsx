/* =========================================================================
   Badge
   Scopo: etichetta colorata compatta per mostrare uno stato (pratica,
     fase, documento, pagamento, calcolo…). Solo grafica.
   Usato da: quasi tutto il portale. Componenti: DettaglioPratica,
     Documenti, Integrazioni, Consultazione, Rapporti, Pagamenti, NoteFase,
     impostazioni/EntiValidazione, impostazioni/ModelliDocumento,
     crediti/RegistroCrediti. Pagine: AreaCliente, BackOffice, Cruscotto,
     TuoiDocumenti, GestioneUtenti, Crediti, CalcoloCrediti.
   Chi lo vede: tutti i ruoli autenticati (cliente/Comune, operatore, admin).
   Dati: nessuno; i colori arrivano dal chiamante (di solito da
     STATI_PRATICA / STATI_FASE in src/lib/cwpProgram.js).
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React from "react";

// Badge generico (stato pratica/fase).
// Props: children (testo), bg (colore di sfondo), fg (colore del testo).
export default function Badge({ children, bg, fg }) {
  return (
    <span
      style={{
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        padding: "3px 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}
