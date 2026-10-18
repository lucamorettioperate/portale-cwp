/* =========================================================================
   NuovoProgetto
   Scopo: finestra (sovrapposta alla pagina) per creare un nuovo Progetto.
     Si sceglie un'organizzazione esistente o se ne crea una nuova, si
     indicano codice (facoltativo) e titolo; alla creazione vengono generate
     le 7 fasi, con la fase 1 «in corso».
   Usato da: pagina BackOffice (/pratiche), pulsante di nuovo progetto.
   Chi lo vede: operatore e admin.
   Dati: elencaOrganizzazioni, creaOrganizzazione, creaPratica
     (src/lib/dati.js); tabelle organizzazione, pratica, fase.
   Sicurezza (garantita dal database, script 02): solo lo staff può creare
     organizzazioni e pratiche (RLS org_write, pratica_write). Codice vuoto:
     lo assegna un trigger (CWP-AAAA-NNNN, script 09); un codice scritto a
     mano viene invece mantenuto così com'è.
     Attenzione: creaPratica fa due inserimenti separati (pratica, poi
     fasi). Se il secondo fallisce la pratica resta senza fasi e qui si vede
     l'errore; anche un'organizzazione nuova resta creata se poi fallisce la
     pratica.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import {
  elencaOrganizzazioni,
  creaOrganizzazione,
  creaPratica,
} from "../lib/dati.js";

/* Finestra per creare un nuovo progetto.
   Si può scegliere un'organizzazione esistente o crearne una nuova.
   Props: onChiudi() (clic su Annulla o fuori dalla finestra),
   onCreato(id) (progetto creato: la pagina lo apre). */
export default function NuovoProgetto({ onChiudi, onCreato }) {
  // ruolo e utente oggi non sono usati in questo componente.
  const { ruolo, utente } = useAuth();
  const [organizzazioni, setOrganizzazioni] = useState([]);
  const [modoOrg, setModoOrg] = useState("esistente"); // 'esistente' | 'nuova'
  const [orgId, setOrgId] = useState("");
  const [nuovaOrg, setNuovaOrg] = useState({ denominazione: "", tipo: "" });
  const [codice, setCodice] = useState("");
  const [titolo, setTitolo] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  // Carica le organizzazioni (in ordine alfabetico) e preseleziona la
  // prima; se non ce n'è nessuna si passa direttamente a «Nuova».
  useEffect(() => {
    elencaOrganizzazioni().then(({ data }) => {
      setOrganizzazioni(data || []);
      if (data && data.length) setOrgId(data[0].id);
      else setModoOrg("nuova");
    });
  }, []);

  // Invio del modulo: crea l'organizzazione (se «Nuova»), poi la pratica
  // con le sue 7 fasi, infine passa l'id alla pagina con onCreato.
  async function onSubmit(e) {
    e.preventDefault();
    setErrore("");
    setInCorso(true);

    let organizzazioneId = orgId;

    // Crea l'organizzazione se richiesto.
    if (modoOrg === "nuova") {
      if (!nuovaOrg.denominazione.trim()) {
        setErrore("Inserisci la denominazione dell'organizzazione.");
        setInCorso(false);
        return;
      }
      const { data, error } = await creaOrganizzazione(nuovaOrg);
      if (error) {
        setErrore("Errore creando l'organizzazione: " + error.message);
        setInCorso(false);
        return;
      }
      organizzazioneId = data.id;
    }

    if (!organizzazioneId) {
      setErrore("Seleziona o crea un'organizzazione.");
      setInCorso(false);
      return;
    }

    // Crea il progetto (genera le 7 fasi).
    const { data: pratica, error } = await creaPratica({
      tipo: "progetto",
      organizzazione_id: organizzazioneId,
      // null = codice automatico assegnato dal database.
      codice: codice.trim() || null,
      titolo: titolo.trim() || null,
      stato: "attiva",
    });
    if (error) {
      setErrore("Errore creando il progetto: " + error.message);
      setInCorso(false);
      return;
    }


    setInCorso(false);
    onCreato && onCreato(pratica.id);
  }

  return (
    // Sfondo scuro a tutto schermo: un clic fuori dalla finestra la chiude
    // (il clic dentro è fermato da stopPropagation).
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(27,33,24,0.45)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 50,
      }}
      onClick={onChiudi}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: C.white,
          borderRadius: 16,
          padding: "26px 26px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 19, margin: "0 0 18px" }}>Nuovo progetto</h2>

        <form onSubmit={onSubmit}>
          {/* Organizzazione */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <TabBtn attivo={modoOrg === "esistente"} onClick={() => setModoOrg("esistente")} disabled={!organizzazioni.length}>
                Organizzazione esistente
              </TabBtn>
              <TabBtn attivo={modoOrg === "nuova"} onClick={() => setModoOrg("nuova")}>
                Nuova
              </TabBtn>
            </div>

            {modoOrg === "esistente" ? (
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} style={campo}>
                {organizzazioni.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.denominazione}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  placeholder="Denominazione (es. Comune di …)"
                  value={nuovaOrg.denominazione}
                  onChange={(e) => setNuovaOrg({ ...nuovaOrg, denominazione: e.target.value })}
                  style={campo}
                />
                <input
                  placeholder="Tipo (es. Ente locale, Soggetto gestore)"
                  value={nuovaOrg.tipo}
                  onChange={(e) => setNuovaOrg({ ...nuovaOrg, tipo: e.target.value })}
                  style={campo}
                />
              </div>
            )}
          </div>

          {/* Dati progetto */}
          <label style={lbl}>
            Codice pratica
            <input placeholder="es. CWP-2026-0001" value={codice} onChange={(e) => setCodice(e.target.value)} style={campo} />
          </label>
          <label style={lbl}>
            Titolo
            <input placeholder="Descrizione breve del progetto" value={titolo} onChange={(e) => setTitolo(e.target.value)} style={campo} />
          </label>

          {errore && <div style={{ color: C.red, fontSize: 13, margin: "6px 0 12px" }}>{errore}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="button" onClick={onChiudi} style={btnSecondario}>
              Annulla
            </button>
            <button type="submit" disabled={inCorso} style={{ ...btnPrimario, flex: 1 }}>
              {inCorso ? "Creazione…" : "Crea progetto"}
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: C.grafite, marginTop: 12, lineHeight: 1.5 }}>
            Alla creazione vengono generate automaticamente le 7 fasi del percorso.
          </p>
        </form>
      </div>
    </div>
  );
}

// Pulsante a linguetta («Organizzazione esistente» / «Nuova»).
// Props: attivo (evidenziato), children, e le altre props del <button>
// (onClick, disabled…).
function TabBtn({ attivo, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      style={{
        flex: 1,
        background: attivo ? C.greenSoft : C.white,
        color: attivo ? C.green : C.grafite,
        border: `1px solid ${attivo ? C.green : C.line}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        fontWeight: 600,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

// Stili locali della finestra (misure più grandi di stili.js).
const campo = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${C.line}`,
  borderRadius: 9,
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  boxSizing: "border-box",
  background: C.white,
};
const lbl = { display: "block", fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 14 };
const btnPrimario = {
  background: C.green,
  color: C.white,
  border: "none",
  borderRadius: 9,
  padding: "11px 16px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
};
const btnSecondario = {
  background: C.white,
  color: C.grafite,
  border: `1px solid ${C.line}`,
  borderRadius: 9,
  padding: "11px 16px",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};
