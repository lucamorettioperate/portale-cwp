/* =========================================================================
   Reclami — indirizzo «/reclami»
   Scopo: reclami e richieste di chiarimento (Politica di reclamo del
     Programma; Guida al Programma cap. 8; script 24).
     - Chiunque abbia un account invia un reclamo o una richiesta di
       chiarimento dal portale e ne segue lo stato e la risposta.
     - Lo staff registra anche quelli arrivati via PEC o email (nome,
       organizzazione, ruolo, contatti, dettagli, conflitto di interessi),
       assegna chi li gestisce, registra la conferma di ricezione, la
       risposta scritta e gli eventuali costi a carico di chi ha presentato
       il reclamo; le note interne restano riservate.
     Codici automatici: REC-AAAA-NNN (reclami), CHI-AAAA-NNN (chiarimenti).
   Chi la usa: tutti gli utenti con accesso (vista diversa per lo staff).
   Dati: elencaReclami, mieiReclami, inviaReclamo, salvaReclamo,
     elencaStaff, elencaProgetti (src/lib/dati.js) sulla tabella reclamo.
   Sicurezza (garantita dal database, script 24): la tabella la leggono e
     scrivono solo Operatori e Amministratori; gli altri inviano con
     invia_reclamo e leggono i propri con miei_reclami (senza note interne);
     ogni modifica è nell'audit; lo staff riceve una notifica per ogni nuovo
     reclamo e l'autore quando arriva la risposta.
   Registro sviluppo e deploy: capitolo «Portale (frontend)», tabella Pagine.
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import { elencaReclami, mieiReclami, inviaReclamo, salvaReclamo, elencaStaff, elencaProgetti } from "../lib/dati.js";
import { formatoData, oggiItalia } from "../lib/date.js";
import { riquadro, campo, etichetta, btnPrimario, btnMini } from "../components/stili.js";

const STATI = ["ricevuto", "in esame", "risposto", "chiuso"];
const RUOLI_MITTENTE = ["promotore del progetto", "ente di validazione e verifica", "sviluppatore di metodologia", "registro", "stakeholder"];
const COLORE_STATO = { ricevuto: [C.ocraSoft, C.amber], "in esame": [C.ocraSoft, C.ocra], risposto: [C.greenSoft, C.green], chiuso: [C.paperWarm, C.grafite] };

/* Pagina dei reclami. Nessuna prop. */
export default function Reclami() {
  const { ruolo } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";
  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Reclami e richieste di chiarimento</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 16px", lineHeight: 1.5 }}>
          Politica di reclamo del Programma Carbon WastePrint®: si può scrivere in qualsiasi momento; si riceve una conferma e
          poi una risposta scritta. Per le questioni con un promotore del progetto, un ente di validazione e verifica o un
          registro rivolgersi prima a loro; qui si trattano l'interpretazione di regole e criteri del Programma.
        </p>
        {staff ? <VistaStaff /> : <VistaUtente />}
      </main>
    </div>
  );
}

/* Utente non staff: nuovo invio e propri reclami. */
function VistaUtente() {
  const [elenco, setElenco] = useState([]);
  const [progetti, setProgetti] = useState([]);
  const [modulo, setModulo] = useState({ tipo: "chiarimento", oggetto: "", dettagli: "", pratica: "", conflitto: "" });
  const [esito, setEsito] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function carica() {
    const [{ data }, { data: p }] = await Promise.all([mieiReclami(), elencaProgetti()]);
    setElenco(data || []);
    setProgetti(p || []);
  }
  useEffect(() => { carica(); }, []);

  async function invia() {
    setErrore("");
    setEsito("");
    if (modulo.oggetto.trim().length < 3) return setErrore("Indica l'oggetto.");
    if (modulo.dettagli.trim().length < 10) return setErrore("Descrivi la questione (almeno 10 caratteri).");
    setInCorso(true);
    const { data, error } = await inviaReclamo({
      tipo: modulo.tipo, oggetto: modulo.oggetto, dettagli: modulo.dettagli,
      praticaId: modulo.pratica || null, conflitto: modulo.conflitto,
    });
    setInCorso(false);
    if (error) return setErrore(error.message);
    setEsito(`Ricevuto con il codice ${data}. La Fondazione risponderà per iscritto.`);
    setModulo({ tipo: "chiarimento", oggetto: "", dettagli: "", pratica: "", conflitto: "" });
    carica();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={riquadro}>
        <h2 style={h2}>Nuovo invio</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          <label style={etichetta}>
            Tipo
            <select value={modulo.tipo} onChange={(e) => setModulo({ ...modulo, tipo: e.target.value })} style={campo}>
              <option value="chiarimento">Richiesta di chiarimento</option>
              <option value="reclamo">Reclamo</option>
            </select>
          </label>
          <label style={etichetta}>
            Progetto (facoltativo)
            <select value={modulo.pratica} onChange={(e) => setModulo({ ...modulo, pratica: e.target.value })} style={campo}>
              <option value="">— nessuno —</option>
              {progetti.map((p) => <option key={p.id} value={p.id}>{p.codice} · {p.titolo || ""}</option>)}
            </select>
          </label>
        </div>
        <label style={etichetta}>Oggetto<input value={modulo.oggetto} onChange={(e) => setModulo({ ...modulo, oggetto: e.target.value })} style={campo} /></label>
        <label style={etichetta}>Dettagli<textarea rows={4} value={modulo.dettagli} onChange={(e) => setModulo({ ...modulo, dettagli: e.target.value })} style={{ ...campo, resize: "vertical" }} /></label>
        <label style={etichetta}>Dichiarazione di eventuali conflitti di interesse<input value={modulo.conflitto} onChange={(e) => setModulo({ ...modulo, conflitto: e.target.value })} style={campo} placeholder="Es. nessuno" /></label>
        {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
        {esito && <div style={{ color: C.green, fontSize: 13, marginBottom: 8 }}>{esito}</div>}
        <button onClick={invia} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Invia"}</button>
        <p style={{ fontSize: 11.5, color: C.grafite, margin: "10px 0 0" }}>
          Le spese per la gestione di un reclamo sono a carico di chi lo presenta, che ne viene informato; non si pagano se
          l'azione contestata viene annullata.
        </p>
      </section>
      <section style={riquadro}>
        <h2 style={h2}>I miei invii</h2>
        {elenco.length === 0 && <div style={{ fontSize: 13, color: C.grafite }}>Nessun invio.</div>}
        {elenco.map((r) => (
          <div key={r.codice} style={riga}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}><b>{r.codice}</b> · {r.oggetto} <span style={{ color: C.grafite }}>· {formatoData(r.ricevuto_il)}</span></span>
              <StatoBadge stato={r.stato} />
            </div>
            {r.risposta && <div style={{ fontSize: 12.5, marginTop: 6, whiteSpace: "pre-wrap" }}><b>Risposta</b> ({formatoData(r.risposto_il)}): {r.risposta}</div>}
            {r.costi != null && <div style={{ fontSize: 12, color: C.grafite }}>Costi: {Number(r.costi).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</div>}
          </div>
        ))}
      </section>
    </div>
  );
}

/* Staff: elenco, registrazione (PEC, email) e gestione. */
function VistaStaff() {
  const [elenco, setElenco] = useState([]);
  const [staff, setStaff] = useState([]);
  const [progetti, setProgetti] = useState([]);
  const [modulo, setModulo] = useState(null);
  const [filtro, setFiltro] = useState("aperti");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function carica() {
    const [{ data }, { data: s }, { data: p }] = await Promise.all([elencaReclami(), elencaStaff(), elencaProgetti()]);
    setElenco(data || []);
    setStaff(s || []);
    setProgetti(p || []);
  }
  useEffect(() => { carica(); }, []);

  const nuovo = { tipo: "reclamo", canale: "pec", ricevuto_il: oggiItalia(), mittente_nome: "", mittente_organizzazione: "", mittente_ruolo: "stakeholder", mittente_contatti: "", pratica_id: "", oggetto: "", dettagli: "", conflitto_interessi: "", stato: "ricevuto", gestore_id: "", conferma_inviata_il: "", risposta: "", costi: "", note_interne: "" };

  async function salva() {
    setErrore("");
    setInCorso(true);
    const { id, codice, creato_il, creato_da, aggiornato_il, risposto_il, ...campi } = modulo;
    const pulito = Object.fromEntries(Object.entries(campi).map(([k, v]) => [k, typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v]));
    pulito.mittente_ruolo = pulito.mittente_ruolo || "stakeholder";
    pulito.costi = pulito.costi == null ? null : Number(String(pulito.costi).replace(",", "."));
    const { error } = await salvaReclamo({ id, ...pulito });
    setInCorso(false);
    if (error) return setErrore(error.message);
    setModulo(null);
    carica();
  }

  const visibili = elenco.filter((r) => filtro === "tutti" || (filtro === "aperti" ? !["risposto", "chiuso"].includes(r.stato) : r.stato === filtro));
  const set = (k) => (e) => setModulo({ ...modulo, [k]: e.target.value });
  const nomeStaff = (id) => staff.find((s) => s.id === id)?.nome_completo || "—";

  return (
    <section style={riquadro}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["aperti", ...STATI, "tutti"].map((f) => (
            <button key={f} onClick={() => setFiltro(f)} style={{ ...btnMini, background: filtro === f ? C.greenSoft : C.white, color: filtro === f ? C.green : C.grafite }}>{f}</button>
          ))}
        </div>
        {!modulo && <button onClick={() => setModulo(nuovo)} style={btnPrimario}>+ Registra (PEC, email)</button>}
      </div>

      {modulo && (
        <div style={{ margin: "12px 0", padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            <label style={etichetta}>Tipo<select value={modulo.tipo} onChange={set("tipo")} disabled={!!modulo.id} style={campo}><option value="reclamo">Reclamo</option><option value="chiarimento">Richiesta di chiarimento</option></select></label>
            <label style={etichetta}>Canale<select value={modulo.canale} onChange={set("canale")} style={campo}>{["pec", "portale", "email", "altro"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={etichetta}>Ricevuto il<input type="date" value={modulo.ricevuto_il || ""} onChange={set("ricevuto_il")} style={campo} /></label>
            <label style={etichetta}>Nome e cognome<input value={modulo.mittente_nome || ""} onChange={set("mittente_nome")} style={campo} /></label>
            <label style={etichetta}>Organizzazione<input value={modulo.mittente_organizzazione || ""} onChange={set("mittente_organizzazione")} style={campo} /></label>
            <label style={etichetta}>Ruolo<select value={modulo.mittente_ruolo} onChange={set("mittente_ruolo")} style={campo}>{RUOLI_MITTENTE.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={etichetta}>Contatti<input value={modulo.mittente_contatti || ""} onChange={set("mittente_contatti")} style={campo} placeholder="PEC, email, telefono" /></label>
            <label style={etichetta}>Progetto<select value={modulo.pratica_id || ""} onChange={set("pratica_id")} style={campo}><option value="">— nessuno —</option>{progetti.map((p) => <option key={p.id} value={p.id}>{p.codice}</option>)}</select></label>
          </div>
          <label style={etichetta}>Oggetto<input value={modulo.oggetto || ""} onChange={set("oggetto")} style={campo} /></label>
          <label style={etichetta}>Dettagli<textarea rows={3} value={modulo.dettagli || ""} onChange={set("dettagli")} style={{ ...campo, resize: "vertical" }} /></label>
          <label style={etichetta}>Conflitto di interessi dichiarato<input value={modulo.conflitto_interessi || ""} onChange={set("conflitto_interessi")} style={campo} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            <label style={etichetta}>Stato<select value={modulo.stato} onChange={set("stato")} style={campo}>{STATI.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={etichetta}>Gestito da<select value={modulo.gestore_id || ""} onChange={set("gestore_id")} style={campo}><option value="">— da assegnare —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.nome_completo || s.id}</option>)}</select></label>
            <label style={etichetta}>Conferma di ricezione inviata il<input type="date" value={modulo.conferma_inviata_il || ""} onChange={set("conferma_inviata_il")} style={campo} /></label>
            <label style={etichetta}>Costi addebitati (€)<input inputMode="decimal" value={modulo.costi ?? ""} onChange={set("costi")} style={campo} /></label>
          </div>
          <label style={etichetta}>Risposta scritta<textarea rows={3} value={modulo.risposta || ""} onChange={set("risposta")} style={{ ...campo, resize: "vertical" }} /></label>
          <label style={etichetta}>Note interne (riservate)<textarea rows={2} value={modulo.note_interne || ""} onChange={set("note_interne")} style={{ ...campo, resize: "vertical" }} /></label>
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={salva} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Salva"}</button>
            <button onClick={() => setModulo(null)} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
        {visibili.length === 0 && <div style={{ fontSize: 13, color: C.grafite }}>Nessun reclamo.</div>}
        {visibili.map((r) => (
          <div key={r.id} style={riga}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}>
                <b>{r.codice}</b> · {r.oggetto}
                <span style={{ color: C.grafite }}> · {r.mittente_nome}{r.mittente_organizzazione ? ` (${r.mittente_organizzazione})` : ""} · {r.mittente_ruolo} · {r.canale} · {formatoData(r.ricevuto_il)}{r.pratica?.codice ? ` · ${r.pratica.codice}` : ""}</span>
              </span>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <StatoBadge stato={r.stato} />
                {!modulo && <button onClick={() => setModulo({ ...nuovo, ...r, costi: r.costi ?? "" })} style={btnMini}>Gestisci</button>}
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.grafite, marginTop: 4 }}>
              Gestito da {nomeStaff(r.gestore_id)}{r.conferma_inviata_il ? ` · conferma inviata il ${formatoData(r.conferma_inviata_il)}` : " · conferma di ricezione da inviare"}
              {r.risposto_il ? ` · risposta del ${formatoData(r.risposto_il)}` : ""}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Badge dello stato di un reclamo.
function StatoBadge({ stato }) {
  const [bg, fg] = COLORE_STATO[stato] || COLORE_STATO.ricevuto;
  return <Badge bg={bg} fg={fg}>{stato}</Badge>;
}

const h2 = { fontFamily: "'Archivo'", fontSize: 16, margin: "0 0 10px" };
const riga = { border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px" };
