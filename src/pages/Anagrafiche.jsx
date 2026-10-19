/* =========================================================================
   Anagrafiche — indirizzo «/anagrafiche»
   Scopo: censimento di Organizzazioni ed Enti di Validazione (requisiti
     §3: l'Operatore «censisce Organizzazioni ed Enti di Validazione»).
     - Organizzazioni: elenco con ricerca, dati essenziali (tipo, codice
       fiscale, partita IVA, PEC, note), fino a 2 persone con delega di
       rappresentanza (Guida 7.2, script 23: una sola di loro ha l'account
       sul portale), pratiche collegate; inserimento e modifica.
       Un'organizzazione non si cancella.
     - Enti di Validazione: componente EntiValidazione, con i Progetti a
       cui ogni ente è assegnato.
     - Registri di scambio dei crediti (Guida 3.5, script 24): componente
       Registri.
   Chi la usa: Operatori e Amministratori (gli altri vedono un messaggio).
   Dati: elencaOrganizzazioni, salvaOrganizzazione, elencaPraticheAnagrafiche
     (src/lib/dati.js) sulle tabelle organizzazione e pratica.
   Sicurezza (garantita dal database, script 21): scrivono solo Operatori e
     Amministratori (RLS org_insert, org_update, ente_insert, ente_update);
     nessuna cancellazione (conservazione per 12 anni); ogni modifica è
     registrata nell'audit.
   Registro sviluppo e deploy: capitolo «Portale (frontend)», tabella Pagine.
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import EntiValidazione from "../components/impostazioni/EntiValidazione.jsx";
import { useOrdinamento, SceltaOrdinamento } from "../components/Ordinamento.jsx";
import Registri from "../components/impostazioni/Registri.jsx";
import { elencaOrganizzazioni, salvaOrganizzazione, elencaPraticheAnagrafiche } from "../lib/dati.js";
import { riquadro, campo, etichetta, btnPrimario, btnMini } from "../components/stili.js";

// Tipi di organizzazione proposti (campo testo libero nel database).
// Soggetti promotori ammessi dallo Standard CWP (cap. 4.4).
const TIPI_ORGANIZZAZIONE = [
  "Ente locale (T.U.E.L.)",
  "EGATO (Ente di governo dell'ambito)",
  "Soggetto gestore a partecipazione pubblica",
  "Soggetto gestore delle tariffe",
  "Soggetto gestore",
  "Azienda",
  "Altro",
];

/* Pagina delle anagrafiche. Nessuna prop. */
export default function Anagrafiche() {
  const { ruolo } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";
  const [pratiche, setPratiche] = useState([]);

  // Pratiche di tutte le organizzazioni: servono a entrambe le sezioni.
  async function caricaPratiche() {
    const { data } = await elencaPraticheAnagrafiche();
    setPratiche(data || []);
  }
  useEffect(() => { if (staff) caricaPratiche(); }, [staff]);

  if (!staff) {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: C.grafite }}>
          Questa sezione è riservata al personale della Fondazione.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Anagrafiche</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 18px" }}>
          Organizzazioni aderenti al Programma ed Enti di Validazione. Nulla si cancella: un ente si disattiva.
        </p>
        <Organizzazioni pratiche={pratiche} />
        <EntiValidazione pratiche={pratiche} />
        <Registri />
      </main>
    </div>
  );
}

/* Sezione «Organizzazioni».
   Props: pratiche (elenco sintetico di tutte le pratiche). */
function Organizzazioni({ pratiche }) {
  const [org, setOrg] = useState([]);
  const [cerca, setCerca] = useState("");
  // null = modulo chiuso; oggetto = organizzazione in modifica (con id) o nuova.
  const [modulo, setModulo] = useState(null);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function carica() {
    const { data, error } = await elencaOrganizzazioni();
    if (error) setErrore(error.message);
    setOrg(data || []);
  }
  useEffect(() => { carica(); }, []);

  // Pratiche per organizzazione: { [organizzazione_id]: [pratica…] }.
  const perOrg = useMemo(() => {
    const m = {};
    pratiche.forEach((p) => { (m[p.organizzazione_id] = m[p.organizzazione_id] || []).push(p); });
    return m;
  }, [pratiche]);

  const q = cerca.trim().toLowerCase();
  const filtrate = org.filter((o) => !q || [o.denominazione, o.codice_fiscale, o.partita_iva, o.pec].some((v) => (v || "").toLowerCase().includes(q)));
  // Ordinamento («Ordina per»).
  const ord = useOrdinamento(filtrate, {
    denominazione: (o) => o.denominazione, tipo: (o) => o.tipo, cf: (o) => o.codice_fiscale,
    pec: (o) => o.pec, pratiche: (o) => (perOrg[o.id] || []).length,
  });
  const visibili = ord.ordinate;

  async function salva() {
    setErrore("");
    if (!modulo.denominazione?.trim()) return setErrore("Indica la denominazione.");
    setInCorso(true);
    const pulito = (v) => (v || "").trim() || null;
    const { error } = await salvaOrganizzazione({
      id: modulo.id,
      denominazione: modulo.denominazione.trim(),
      tipo: pulito(modulo.tipo),
      codice_fiscale: pulito(modulo.codice_fiscale),
      partita_iva: pulito(modulo.partita_iva),
      pec: pulito(modulo.pec),
      note: pulito(modulo.note),
      // Al massimo 2 delegati (vincolo chk_delegati, script 23).
      delegati: [modulo.delegato1, modulo.delegato2].map((d) => (d || "").trim()).filter(Boolean),
    });
    setInCorso(false);
    if (error) return setErrore(error.message);
    setModulo(null);
    carica();
  }

  const nuova = { denominazione: "", tipo: TIPI_ORGANIZZAZIONE[0], codice_fiscale: "", partita_iva: "", pec: "", note: "", delegato1: "", delegato2: "" };

  return (
    <section style={riquadro}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: 0 }}>Organizzazioni</h2>
        {!modulo && <button onClick={() => setModulo(nuova)} style={btnPrimario}>+ Nuova organizzazione</button>}
      </div>
      <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per nome, codice fiscale, partita IVA o PEC…" style={{ ...campo, margin: "12px 0" }} aria-label="Cerca organizzazione" />

      {modulo && <ModuloOrganizzazione modulo={modulo} setModulo={setModulo} onSalva={salva} inCorso={inCorso} errore={errore} />}

      {org.length > 1 && <SceltaOrdinamento ord={ord} opzioni={[["denominazione", "Denominazione"], ["tipo", "Tipo"], ["cf", "Codice fiscale"], ["pec", "PEC"], ["pratiche", "Numero di pratiche"]]} style={{ marginBottom: 10, flexWrap: "wrap" }} />}
      {visibili.length === 0 && <div style={{ fontSize: 13, color: C.grafite }}>Nessuna organizzazione.</div>}
      <div style={{ display: "grid", gap: 6 }}>
        {visibili.map((o) => {
          const lista = perOrg[o.id] || [];
          return (
            <div key={o.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 13, minWidth: 0 }}>
                <b>{o.denominazione}</b>{o.tipo && <span style={{ color: C.grafite }}> · {o.tipo}</span>}
                <div style={{ fontSize: 11.5, color: C.grafite }}>
                  {[o.codice_fiscale && `C.F. ${o.codice_fiscale}`, o.partita_iva && `P.IVA ${o.partita_iva}`, o.pec].filter(Boolean).join(" · ") || "Dati fiscali non indicati"}
                </div>
                {(o.delegati || []).length > 0 && (
                  <div style={{ fontSize: 11.5, color: C.grafite }}>Delegati: {o.delegati.join(", ")}</div>
                )}
                <div style={{ fontSize: 11.5, color: C.grafite }}>
                  {lista.length ? `Pratiche: ${lista.map((p) => p.codice || p.titolo).join(", ")}` : "Nessuna pratica"}
                </div>
              </div>
              {!modulo && <button onClick={() => setModulo({ ...nuova, ...o, delegato1: (o.delegati || [])[0] || "", delegato2: (o.delegati || [])[1] || "" })} style={btnMini}>Modifica</button>}
            </div>
          );
        })}
      </div>
      {!modulo && errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}
    </section>
  );
}

/* Modulo di inserimento / modifica di un'organizzazione.
   Props: modulo (valori), setModulo, onSalva, inCorso, errore. */
function ModuloOrganizzazione({ modulo, setModulo, onSalva, inCorso, errore }) {
  const set = (k) => (e) => setModulo({ ...modulo, [k]: e.target.value });
  return (
    <div style={{ marginBottom: 12, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        <label style={etichetta}>Denominazione *<input value={modulo.denominazione || ""} onChange={set("denominazione")} style={campo} placeholder="Es. Comune di Borgoval" /></label>
        <label style={etichetta}>
          Tipo
          <select value={modulo.tipo || ""} onChange={set("tipo")} style={campo}>
            {[...new Set([...TIPI_ORGANIZZAZIONE, modulo.tipo].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label style={etichetta}>Codice fiscale<input value={modulo.codice_fiscale || ""} onChange={set("codice_fiscale")} style={campo} /></label>
        <label style={etichetta}>Partita IVA<input value={modulo.partita_iva || ""} onChange={set("partita_iva")} style={campo} /></label>
        <label style={etichetta}>PEC<input type="email" value={modulo.pec || ""} onChange={set("pec")} style={campo} /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        <label style={etichetta}>Delegato 1 (rappresentante con account)<input value={modulo.delegato1 || ""} onChange={set("delegato1")} style={campo} placeholder="Nome e cognome" /></label>
        <label style={etichetta}>Delegato 2 (sostituto, senza account)<input value={modulo.delegato2 || ""} onChange={set("delegato2")} style={campo} placeholder="Nome e cognome" /></label>
      </div>
      <div style={{ fontSize: 11.5, color: C.grafite, margin: "-4px 0 10px" }}>
        Dal Modulo di delega di rappresentanza (Guida 7.2): fino a 2 persone, una sola con l'account sul portale.
      </div>
      <label style={etichetta}>Note<textarea value={modulo.note || ""} onChange={set("note")} rows={2} style={{ ...campo, resize: "vertical" }} /></label>
      {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSalva} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Salva"}</button>
        <button onClick={() => setModulo(null)} style={btnMini}>Annulla</button>
      </div>
    </div>
  );
}
