/* =========================================================================
   Pratiche (Back-office) — indirizzo «/pratiche» (con «?id=<pratica>» si
   apre direttamente una pratica)
   Scopo: a sinistra l'elenco dei Progetti (con ricerca oltre 4 voci), a
     destra il dettaglio della pratica scelta con le sue fasi, documenti,
     integrazioni, consultazione, pagamenti, rapporti. Pulsante
     «+ Nuovo progetto» per registrare un nuovo Progetto. Sul telefono
     (fino a 760 px, 22/10/2026) elenco e dettaglio si vedono uno alla
     volta: toccando una pratica si apre il dettaglio con «← Tutte le
     pratiche» in alto.
   Chi la usa: Operatore e Amministratore. Un cliente che apre l'indirizzo
     viene rimandato a «/».
   Dati: elencaProgetti() di src/lib/dati.js (tabella "pratica"); il
     dettaglio è il componente DettaglioPratica, la creazione il componente
     NuovoProgetto (creaPratica: pratica + 7 fasi).
   Sicurezza: il rimando a «/» è solo interfaccia. Ciò che conta lo fa il
     database: lettura e scrittura delle pratiche consentite allo staff solo
     con app_is_staff() (ruolo operatore/admin, profilo attivo e, se
     l'interruttore mfa_obbligatoria è acceso, sessione a due fattori).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { COLORI as C, STATI_PRATICA } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import DettaglioPratica from "../components/DettaglioPratica.jsx";
import BarraFasi from "../components/BarraFasi.jsx";
import NuovoProgetto from "../components/NuovoProgetto.jsx";
import { elencaProgetti } from "../lib/dati.js";
import { useOrdinamento, SceltaOrdinamento } from "../components/Ordinamento.jsx";
import { useTelefono } from "../lib/useTelefono.js";

/* Pagina del back-office. Nessuna prop.
   Stato principale: elenco progetti, pratica selezionata (nell'indirizzo),
   testo di ricerca, apertura della finestra «Nuovo progetto». */
export default function BackOffice() {
  const { ruolo } = useAuth();
  const [progetti, setProgetti] = useState([]);
  // La pratica aperta è nell'indirizzo (?id=…): così cruscotto e notifiche
  // possono aprire direttamente una pratica.
  const [params, setParams] = useSearchParams();
  const selId = params.get("id");
  // Selezionare una pratica = scrivere ?id= nell'indirizzo (null lo toglie).
  const setSelId = (id) => { setParams(id ? { id } : {}); if (telefonoRef.current) window.scrollTo(0, 0); };
  // Telefono (22/10/2026): elenco e dettaglio uno alla volta; il dettaglio
  // ha in alto «← Tutte le pratiche» e all'apertura non si sceglie da sola
  // la prima pratica.
  const telefono = useTelefono();
  const telefonoRef = useRef(telefono);
  telefonoRef.current = telefono;
  const [cerca, setCerca] = useState("");
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [creazione, setCreazione] = useState(false);

  // Rilegge l'elenco dei progetti dal database. Se l'indirizzo non indica
  // una pratica, seleziona la prima (la più recente). Usata all'apertura,
  // dopo una modifica nel dettaglio (onAggiornato) e dopo una creazione.
  async function ricarica() {
    setCaricamento(true);
    const { data, error } = await elencaProgetti();
    if (error) setErrore(error.message);
    else {
      setProgetti(data || []);
      if (!params.get("id") && data && data.length && !telefonoRef.current) setSelId(data[0].id);
    }
    setCaricamento(false);
  }

  useEffect(() => {
    ricarica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staff = ruolo === "operatore" || ruolo === "admin";
  // Solo interfaccia: un cliente viene rimandato alla propria area. Finché
  // il ruolo non è noto (null) la pagina resta visibile.
  // Elenco filtrato dalla ricerca e ordinabile («Ordina per»); senza
  // scelta resta dal più recente.
  const filtrati = progetti.filter((p) => !cerca.trim() || [p.codice, p.titolo, p.organizzazione?.denominazione].some((v) => (v || "").toLowerCase().includes(cerca.trim().toLowerCase())));
  const ord = useOrdinamento(filtrati, {
    organizzazione: (p) => p.organizzazione?.denominazione,
    codice: (p) => p.codice,
    titolo: (p) => p.titolo,
    stato: (p) => (STATI_PRATICA[p.stato] || {}).label || p.stato,
    creato: (p) => p.creato_il,
  });

  if (ruolo && !staff) return <Navigate to="/" replace />;

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />

      <div
        className="layout-pratiche"
        style={{
          display: "grid",
          gap: 22,
          padding: "22px 24px",
          maxWidth: 1320,
          margin: "0 auto",
        }}
      >
        {/* Lista progetti (sul telefono solo se nessuna pratica è aperta) */}
        {!(telefono && selId) && (
        <aside>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2
              style={{
                fontFamily: "'Archivo'",
                fontSize: 13,
                margin: 0,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: C.grafite,
              }}
            >
              Progetti
            </h2>
            {staff && (
              <button
                onClick={() => setCreazione(true)}
                style={{
                  background: C.green,
                  color: C.white,
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Nuovo progetto
              </button>
            )}
          </div>

          {caricamento && <div style={{ color: C.grafite, fontSize: 13 }}>Caricamento…</div>}
          {errore && <div style={{ color: C.red, fontSize: 13 }}>{errore}</div>}

          {!caricamento && !errore && progetti.length === 0 && (
            <div
              style={{
                background: C.white,
                border: `1px dashed ${C.line}`,
                borderRadius: 12,
                padding: "24px 18px",
                textAlign: "center",
                color: C.grafite,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Nessun progetto ancora.
              {staff && <><br />Crea il primo con “+ Nuovo progetto”.</>}
            </div>
          )}

          {progetti.length > 4 && (
            <input
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cerca…"
              aria-label="Cerca progetto"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, marginBottom: 10 }}
            />
          )}

          {progetti.length > 1 && (
            <SceltaOrdinamento
              ord={ord}
              opzioni={[["organizzazione", "Organizzazione"], ["codice", "Codice"], ["titolo", "Titolo"], ["stato", "Stato"], ["creato", "Data di creazione"]]}
              style={{ marginBottom: 10, flexWrap: "wrap" }}
            />
          )}

          {/* Filtro nel browser su codice, titolo e denominazione
              dell'organizzazione (senza distinzione di maiuscole), poi
              ordinamento scelto. */}
          {ord.ordinate.map((p) => {
            const st = STATI_PRATICA[p.stato] || STATI_PRATICA.attiva;
            const attivo = p.id === selId;
            return (
              <button
                key={p.id}
                onClick={() => setSelId(p.id)}
                style={{
                  textAlign: "left",
                  width: "100%",
                  background: attivo ? C.white : "transparent",
                  border: `1px solid ${attivo ? C.green : C.line}`,
                  borderLeft: `4px solid ${attivo ? C.green : C.line}`,
                  borderRadius: 10,
                  padding: "13px 15px",
                  cursor: "pointer",
                  marginBottom: 9,
                }}
              >
                {/* In alto a destra la barra a LED delle 7 fasi (21/10/2026);
                    lo stato della pratica sulla riga sotto. */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Archivo'", fontWeight: 700, fontSize: 13.5, color: C.ink }}>
                    {p.organizzazione?.denominazione || "—"}
                  </span>
                  <BarraFasi fasi={p.fasi || []} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 12, color: C.grafite }}>
                    {p.codice || "senza codice"} · {p.titolo || "—"}
                  </span>
                  <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
                </div>
              </button>
            );
          })}
        </aside>
        )}

        {/* Dettaglio */}
        <main>
          {telefono && selId && (
            <button onClick={() => setSelId(null)} style={{ marginBottom: 12, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 10, padding: "0 14px", fontSize: 14, fontWeight: 600, color: C.green, cursor: "pointer" }}>
              ← Tutte le pratiche
            </button>
          )}
          {selId ? (
            <DettaglioPratica key={selId} praticaId={selId} onAggiornato={ricarica} onApri={setSelId} />
          ) : (
            !caricamento && !telefono && (
              <div
                style={{
                  background: C.white,
                  border: `1px solid ${C.line}`,
                  borderRadius: 14,
                  padding: "40px 28px",
                  textAlign: "center",
                  color: C.grafite,
                }}
              >
                Seleziona un progetto a sinistra per vederne il dettaglio.
              </div>
            )
          )}
        </main>
      </div>

      {creazione && (
        <NuovoProgetto
          onChiudi={() => setCreazione(false)}
          onCreato={(id) => {
            // Chiude la finestra, rilegge l'elenco e apre il progetto appena creato.
            setCreazione(false);
            ricarica().then(() => id && setSelId(id));
          }}
        />
      )}
    </div>
  );
}
