/* =========================================================================
   Le mie pratiche (Area Cliente) — indirizzo «/» per il ruolo cliente
   (src/App.jsx, HomePerRuolo: è la vista predefinita anche se il profilo
   non ha ancora un ruolo).
   Scopo: il Comune/azienda vede l'elenco dei propri Progetti (schede
     compatte con stato) e, sotto, il dettaglio della pratica selezionata:
     fasi, documenti, integrazioni, messaggi. Link al Manuale Utente in PDF.
     Sul telefono (fino a 760 px, 22/10/2026) elenco e dettaglio uno alla
     volta, con «← Tutte le pratiche»; con una sola pratica si apre subito.
   Chi la usa: cliente (Comune o gestore). Lo staff arriva invece al Cruscotto.
   Dati: elencaProgetti() di src/lib/dati.js (tabella "pratica" con
     l'organizzazione); il dettaglio è il componente DettaglioPratica.
   Sicurezza: il filtro «solo le pratiche della mia organizzazione» lo fa il
     database (RLS pratica_select, script 06: app_org_mia). La pagina non
     filtra nulla: mostra ciò che il database restituisce. Le azioni
     consentite al cliente dentro il dettaglio sono anch'esse decise da RLS
     e dalle funzioni del database.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { COLORI as C, STATI_PRATICA, STATI_FASE } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import DettaglioPratica from "../components/DettaglioPratica.jsx";
import BarraFasi from "../components/BarraFasi.jsx";
import { elencaProgetti } from "../lib/dati.js";
import { useOrdinamento, SceltaOrdinamento } from "../components/Ordinamento.jsx";
import { useTelefono } from "../lib/useTelefono.js";

/* Pagina principale del cliente.
   Nessuna prop. Legge i progetti una volta all'apertura e, se l'indirizzo
   non indica già una pratica, seleziona la prima dell'elenco.
   La pratica selezionata vive nel parametro ?id= dell'indirizzo. */
export default function AreaCliente() {
  const { profilo } = useAuth();
  const [progetti, setProgetti] = useState([]);
  // Pratica aperta nell'indirizzo (?id=…), così le notifiche la aprono.
  const [params, setParams] = useSearchParams();
  const selId = params.get("id");
  // Cambiare pratica = cambiare l'indirizzo (senza id si toglie il parametro).
  const setSelId = (id) => { setParams(id ? { id } : {}); if (telefonoRef.current) window.scrollTo(0, 0); };
  // Telefono (22/10/2026): elenco e dettaglio uno alla volta; con una sola
  // pratica si apre subito il dettaglio.
  const telefono = useTelefono();
  const telefonoRef = useRef(telefono);
  telefonoRef.current = telefono;
  const [caricamento, setCaricamento] = useState(true);

  // Caricamento iniziale (una sola volta). Gli errori di lettura non sono
  // mostrati: in caso di errore l'elenco resta vuoto.
  useEffect(() => {
    elencaProgetti().then(({ data }) => {
      setProgetti(data || []);
      // Se si arriva da una notifica l'id è già nell'indirizzo: lo si rispetta.
      if (!params.get("id") && data && data.length && (!telefonoRef.current || data.length === 1)) setSelId(data[0].id);
      setCaricamento(false);
    });
  }, []);

  // Ordinamento delle pratiche («Ordina per»).
  const ord = useOrdinamento(progetti, {
    titolo: (p) => p.titolo, codice: (p) => p.codice, organizzazione: (p) => p.organizzazione?.denominazione,
    stato: (p) => (STATI_PRATICA[p.stato] || {}).label || p.stato, creato: (p) => p.creato_il,
  });

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />

      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "24px 24px",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px", letterSpacing: -0.4 }}>
            Le mie pratiche
          </h1>
          <p style={{ fontSize: 13.5, color: C.grafite, margin: 0 }}>
            Stato e avanzamento dei progetti della tua organizzazione. Serve aiuto? Consulta il{" "}
            <a href="/manuali/Manuale_Utente_Portale_CWP.pdf" target="_blank" rel="noreferrer" style={{ color: C.green, fontWeight: 600 }}>manuale utente (PDF)</a>.
          </p>
        </div>

        {caricamento && <div style={{ color: C.grafite, fontSize: 13 }}>Caricamento…</div>}

        {!caricamento && progetti.length === 0 && (
          <div
            style={{
              background: C.white,
              border: `1px dashed ${C.line}`,
              borderRadius: 12,
              padding: "32px 24px",
              textAlign: "center",
              color: C.grafite,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Non risultano ancora pratiche a tuo carico.<br />
            Quando la Fondazione registrerà il tuo progetto, lo vedrai qui.
          </div>
        )}

        {progetti.length > 0 && (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Riepilogo pratiche (card compatte), ordinabili */}
            {telefono && selId && progetti.length > 1 && (
              <button onClick={() => setSelId(null)} style={{ justifySelf: "start", background: "transparent", border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 14px", fontSize: 14, fontWeight: 600, color: C.green, cursor: "pointer" }}>
                ← Tutte le pratiche
              </button>
            )}
            {!(telefono && selId) && (
            <div style={{ display: "grid", gap: 10 }}>
              {progetti.length > 1 && (
                <SceltaOrdinamento ord={ord} opzioni={[["titolo", "Titolo"], ["codice", "Codice"], ["organizzazione", "Organizzazione"], ["stato", "Stato"], ["creato", "Data di creazione"]]} style={{ flexWrap: "wrap" }} />
              )}
              {ord.ordinate.map((p) => {
                const st = STATI_PRATICA[p.stato] || STATI_PRATICA.attiva;
                const attivo = p.id === selId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelId(p.id)}
                    style={{
                      textAlign: "left",
                      background: C.white,
                      border: `1px solid ${attivo ? C.green : C.line}`,
                      borderLeft: `4px solid ${attivo ? C.green : C.line}`,
                      borderRadius: 12,
                      padding: "15px 18px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'Archivo'", fontWeight: 700, fontSize: 15 }}>
                        {p.titolo || "Progetto"}
                      </span>
                      {/* Barra a LED delle 7 fasi in alto a destra (21/10/2026). */}
                      <BarraFasi fasi={p.fasi || []} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 12.5, color: C.grafite }}>
                        {p.codice || "senza codice"}
                        {p.organizzazione?.denominazione ? ` · ${p.organizzazione.denominazione}` : ""}
                      </span>
                      <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
            )}

            {/* Dettaglio della pratica selezionata. key={selId} ricrea il
                componente a ogni cambio di pratica (stato interno azzerato).
                onApri permette di passare a un'altra pratica (es. un Rapporto). */}
            {selId && <DettaglioPratica key={selId} praticaId={selId} onApri={setSelId} />}
          </div>
        )}
      </div>
    </div>
  );
}
