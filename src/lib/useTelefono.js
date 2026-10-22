/* =========================================================================
   useTelefono.js — vero quando lo schermo è largo al massimo 760 px
   (telefono), aggiornato se cambia (rotazione, finestra ridimensionata).
   Richiesta di Luca del 22/10/2026: navigazione ottimizzata da smartphone.
   Usato da: Header.jsx (menu a pannello), BackOffice.jsx e AreaCliente.jsx
   (sul telefono elenco e dettaglio della pratica uno alla volta).
   La stessa soglia è nelle regole @media di src/styles/global.css.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import { useEffect, useState } from "react";

export const SOGLIA_TELEFONO = "(max-width: 760px)";

export function useTelefono() {
  const [telefono, setTelefono] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(SOGLIA_TELEFONO).matches);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(SOGLIA_TELEFONO);
    const cambia = () => setTelefono(mq.matches);
    mq.addEventListener("change", cambia);
    return () => mq.removeEventListener("change", cambia);
  }, []);
  return telefono;
}
