/* =========================================================================
   Audit User — indirizzo «/audit-utenti»
   Scopo (richiesta di Luca del 20/10/2026, backlog 40): sezione riservata
     all'Amministratore principale (luca.moretti@operate.it) con tre schede:
     1. «Utenti e stato online»: tutti gli utenti, chi è collegato adesso
        (pagina aperta, da quanto) e chi no, ultimo accesso, accessi e
        tentativi non riusciti degli ultimi 30 giorni, ultima operazione;
     2. «Accessi»: registro di entrate, uscite e tentativi di accesso non
        riusciti, con data e ora, filtrabile per utente, periodo ed evento;
     3. «Operazioni»: tutte le operazioni dell'audit trail (chi, che cosa,
        su quale pratica, data e ora), compreso lo scaricamento dei
        documenti, filtrabili per utente, periodo e testo.
     Ogni tabella si ordina per colonna e si esporta in CSV.
   Chi la vede: solo l'Amministratore principale. Gli altri ricevono un
     messaggio; il controllo vero è nel database (funzioni audit_* dello
     script 33, che rifiutano chiunque altro).
   Dati: auditUtentiStato, auditRegistroAccessi, auditOperazioniUtente
     (src/lib/dati.js). Sola lettura: il registro non si modifica.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»; script 33.
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C, RUOLI } from "../lib/cwpProgram.js";
import Header from "../components/Header.jsx";
import { usePrincipale } from "../components/UtentiOnline.jsx";
import { auditOperazioniUtente, auditRegistroAccessi, auditUtentiStato } from "../lib/dati.js";
import { durata, nomePagina } from "../lib/presenza.js";
import { useOrdinamento, ThOrdinabile } from "../components/Ordinamento.jsx";
import { scaricaTesto, scriviCsv } from "../lib/csv.js";

// Nomi leggibili degli eventi di accesso.
const EVENTI = {
  accesso: "Accesso",
  uscita: "Uscita (Esci)",
  accesso_non_riuscito: "Accesso non riuscito",
};

// Data e ora italiana con i secondi (gg/mm/aaaa hh:mm:ss).
const dataOra = (v) =>
  v ? new Date(v).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

// Data e ora brevi per la tabella degli utenti: «oggi 14:27», «19/10 09:05»,
// con l'anno solo se non è quello in corso.
function dataBreve(v) {
  if (!v) return "—";
  const d = new Date(v);
  const z = { timeZone: "Europe/Rome" };
  const ora = d.toLocaleTimeString("it-IT", { ...z, hour: "2-digit", minute: "2-digit" });
  const giorno = d.toLocaleDateString("it-IT", z);
  if (giorno === new Date().toLocaleDateString("it-IT", z)) return `oggi ${ora}`;
  const annoUguale = d.toLocaleDateString("it-IT", { ...z, year: "numeric" }) === new Date().toLocaleDateString("it-IT", { ...z, year: "numeric" });
  return `${d.toLocaleDateString("it-IT", { ...z, day: "2-digit", month: "2-digit", ...(annoUguale ? {} : { year: "2-digit" }) })} ${ora}`;
}

// Data ISO (aaaa-mm-gg) di oggi meno n giorni, per i campi data.
function giornoIso(menoGiorni = 0) {
  const d = new Date(Date.now() - menoGiorni * 86400000);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}
// Dal giorno (incluso) e al giorno (incluso) → intervallo per il database.
const inizioGiorno = (g) => (g ? new Date(`${g}T00:00:00`).toISOString() : null);
const dopoGiorno = (g) => (g ? new Date(new Date(`${g}T00:00:00`).getTime() + 86400000).toISOString() : null);

/* Pagina. Nessuna prop. */
export default function AuditUtenti() {
  const principale = usePrincipale();
  const [scheda, setScheda] = useState("utenti");
  const [utenti, setUtenti] = useState([]);
  const [errore, setErrore] = useState("");
  // Filtri comuni a «Accessi» e «Operazioni».
  const [utenteScelto, setUtenteScelto] = useState("");
  const [dal, setDal] = useState(giornoIso(30));
  const [al, setAl] = useState(giornoIso(0));

  // Stato degli utenti: subito e poi ogni 30 secondi (stato online).
  useEffect(() => {
    if (!principale) return undefined;
    async function carica() {
      const { data, error } = await auditUtentiStato();
      if (error) setErrore(error.message);
      else {
        setErrore("");
        setUtenti(data || []);
      }
    }
    carica();
    const t = setInterval(carica, 30000);
    return () => clearInterval(t);
  }, [principale]);

  if (!principale) {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: C.grafite }}>
          Questa sezione è riservata all'Amministratore principale.
        </div>
      </div>
    );
  }

  // Dalla scheda Utenti: apre accessi o operazioni di una persona.
  function apri(utenteId, quale) {
    setUtenteScelto(utenteId);
    setScheda(quale);
  }

  const online = utenti.filter((u) => u.online).length;
  const schede = [
    ["utenti", `Utenti e stato online (${online} online)`],
    ["accessi", "Accessi"],
    ["operazioni", "Operazioni"],
  ];

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Audit User</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 14px", maxWidth: 820 }}>
          Chi è collegato, chi è entrato e uscito e quali operazioni ha svolto, con data e ora. Riservato all'Amministratore principale; registro
          automatico e non modificabile.
        </p>
        {errore && (
          <div style={{ background: "#fbeeea", color: C.red, borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>
            {/function .* does not exist|Could not find the function/i.test(errore)
              ? "La sezione non è ancora attiva: va eseguito lo script 33 nel SQL Editor di Supabase."
              : errore}
          </div>
        )}
        <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {schede.map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={scheda === k}
              onClick={() => setScheda(k)}
              style={{
                padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${scheda === k ? C.green : C.line}`, background: scheda === k ? C.green : C.white, color: scheda === k ? C.white : C.ink,
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {scheda === "utenti" && <SchedaUtenti utenti={utenti} onApri={apri} />}
        {scheda !== "utenti" && (
          <Filtri utenti={utenti} utenteScelto={utenteScelto} setUtenteScelto={setUtenteScelto} dal={dal} setDal={setDal} al={al} setAl={setAl} />
        )}
        {scheda === "accessi" && <SchedaAccessi utente={utenteScelto} dal={dal} al={al} />}
        {scheda === "operazioni" && <SchedaOperazioni utente={utenteScelto} dal={dal} al={al} />}
      </main>
    </div>
  );
}

/* Filtri utente e periodo. Props: elenco utenti e coppie valore/setter. */
function Filtri({ utenti, utenteScelto, setUtenteScelto, dal, setDal, al, setAl }) {
  const ordinati = [...utenti].sort((a, b) => (a.nome_completo || a.email).localeCompare(b.nome_completo || b.email, "it"));
  return (
    <div style={{ ...riquadro, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
      <label style={lbl}>
        Utente
        <select value={utenteScelto} onChange={(e) => setUtenteScelto(e.target.value)} style={{ ...campo, minWidth: 240 }}>
          <option value="">Tutti gli utenti</option>
          {ordinati.map((u) => (
            <option key={u.id} value={u.id}>{u.nome_completo ? `${u.nome_completo} (${u.email})` : u.email}</option>
          ))}
        </select>
      </label>
      <label style={lbl}>
        Dal
        <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} style={campo} />
      </label>
      <label style={lbl}>
        Al
        <input type="date" value={al} onChange={(e) => setAl(e.target.value)} style={campo} />
      </label>
    </div>
  );
}

/* Scheda 1: tutti gli utenti con stato online. Props: utenti, onApri(id, scheda). */
function SchedaUtenti({ utenti, onApri }) {
  const ord = useOrdinamento(utenti, {
    stato: (u) => (u.online ? 1 : 0),
    utente: (u) => u.nome_completo || u.email,
    ruolo: (u) => `${RUOLI[u.ruolo]?.short || u.ruolo} ${u.organizzazione || ""}`,
    visto: (u) => u.visto_il,
    accesso: (u) => u.ultimo_accesso,
    accessi: (u) => Number(u.accessi_30),
    falliti: (u) => Number(u.falliti_30),
    operazione: (u) => u.ultima_operazione,
    operazioni: (u) => Number(u.operazioni_30),
  });
  const online = utenti.filter((u) => u.online).length;
  const falliti = utenti.reduce((s, u) => s + Number(u.falliti_30 || 0), 0);

  function esporta() {
    scaricaTesto(
      `Audit_trail_user_utenti_${giornoIso(0)}.csv`,
      scriviCsv(
        ["Stato", "Nome", "Email", "Ruolo", "Organizzazione", "Pagina aperta", "Ultima presenza", "Ultimo accesso", "Accessi 30 gg", "Accessi non riusciti 30 gg", "Ultima operazione", "Operazioni 30 gg", "Account"],
        ord.ordinate.map((u) => [u.online ? "online" : "non collegato", u.nome_completo || "", u.email, RUOLI[u.ruolo]?.short || u.ruolo, u.organizzazione || "", u.online ? nomePagina(u.pagina) : "", dataOra(u.visto_il), dataOra(u.ultimo_accesso), Number(u.accessi_30), Number(u.falliti_30), dataOra(u.ultima_operazione), Number(u.operazioni_30), u.attivo ? "attivo" : "disattivato"])
      )
    );
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Riquadro titolo="Online adesso" valore={online} colore={online ? C.green : C.grafite} />
        <Riquadro titolo="Utenti registrati" valore={utenti.length} />
        <Riquadro titolo="Account attivi" valore={utenti.filter((u) => u.attivo).length} />
        <Riquadro titolo="Accessi non riusciti (30 gg)" valore={falliti} colore={falliti ? C.ocra : C.grafite} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: C.grafite }}>Si aggiorna ogni 30 secondi. Online = pagina del portale aperta nell'ultimo paio di minuti.</span>
        <button onClick={esporta} disabled={!utenti.length} style={btnMini}>Esporta CSV</button>
      </div>
      <div style={{ ...riquadroTabella }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 980 }}>
          <thead>
            <tr style={intest}>
              <ThOrdinabile ord={ord} chiave="stato" style={th}>Stato</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="utente" style={th}>Utente</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="ruolo" style={th}>Ruolo e organizzazione</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="visto" style={th}>Pagina / ultima presenza</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="accesso" style={th}>Ultimo accesso</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="accessi" style={{ ...th, textAlign: "right" }}>Accessi 30 gg</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="falliti" style={{ ...th, textAlign: "right" }}>Non riusciti</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="operazione" style={th}>Ultima operazione</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="operazioni" style={{ ...th, textAlign: "right" }}>Operaz. 30 gg</ThOrdinabile>
              <th style={th}>Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            {utenti.length === 0 && <tr><td colSpan={10} style={{ ...td, color: C.grafite }}>Caricamento…</td></tr>}
            {ord.ordinate.map((u) => {
              const r = RUOLI[u.ruolo];
              return (
                <tr key={u.id} style={{ borderTop: `1px solid ${C.line}`, background: u.online ? "#f1f7ef" : "transparent", opacity: u.attivo ? 1 : 0.6 }}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 6, background: u.online ? "#2fb24c" : "#b9bdb3" }} />
                    <b style={{ color: u.online ? C.green : C.grafite }}>{u.online ? "Online" : "Non collegato"}</b>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{u.nome_completo || u.email}</div>
                    {u.nome_completo && <div style={{ fontSize: 11.5, color: C.grafite }}>{u.email}</div>}
                    {!u.attivo && <div style={{ fontSize: 11, color: C.red }}>account disattivato</div>}
                  </td>
                  <td style={td}>
                    {r ? <span style={{ fontSize: 11, fontWeight: 600, color: r.color, background: r.soft, padding: "2px 8px", borderRadius: 999 }}>{r.short}</span> : u.ruolo}
                    {u.organizzazione && <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 3 }}>{u.organizzazione}</div>}
                  </td>
                  <td style={td}>
                    {u.online ? (
                      <>su «{nomePagina(u.pagina)}»<div style={{ fontSize: 11.5, color: C.grafite }}>collegato da {durata(u.collegato_dal)}</div></>
                    ) : dataBreve(u.visto_il)}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{dataBreve(u.ultimo_accesso)}</td>
                  <td style={tdNum}>{Number(u.accessi_30)}</td>
                  <td style={{ ...tdNum, color: Number(u.falliti_30) ? C.ocra : C.ink, fontWeight: Number(u.falliti_30) ? 700 : 400 }}>{Number(u.falliti_30)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{dataBreve(u.ultima_operazione)}</td>
                  <td style={tdNum}>{Number(u.operazioni_30)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => onApri(u.id, "accessi")} style={btnLink}>Accessi</button>
                    <button onClick={() => onApri(u.id, "operazioni")} style={btnLink}>Operazioni</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* Scheda 2: registro degli accessi. Props: utente (id o ""), dal, al. */
function SchedaAccessi({ utente, dal, al }) {
  const [righe, setRighe] = useState(null);
  const [evento, setEvento] = useState("");
  const [limite, setLimite] = useState(500);
  const [errore, setErrore] = useState("");
  useEffect(() => {
    setRighe(null);
    auditRegistroAccessi({ utente: utente || null, dal: inizioGiorno(dal), al: dopoGiorno(al), evento: evento || null, limite }).then(({ data, error }) => {
      setErrore(error ? error.message : "");
      setRighe(data || []);
    });
  }, [utente, dal, al, evento, limite]);
  const ord = useOrdinamento(righe || [], {
    data: (r) => r.avvenuto_il, utente: (r) => r.nome_completo || r.email, ruolo: (r) => r.ruolo, evento: (r) => EVENTI[r.evento] || r.evento,
  });

  function esporta() {
    scaricaTesto(
      `Audit_trail_user_accessi_${dal}_${al}.csv`,
      scriviCsv(["Data e ora", "Nome", "Email", "Ruolo", "Evento", "Dettaglio"], ord.ordinate.map((r) => [dataOra(r.avvenuto_il), r.nome_completo || "", r.email || "", r.ruolo || "", EVENTI[r.evento] || r.evento, dettaglioAccesso(r)]))
    );
  }

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["", "Tutti gli eventi"], ["accesso", "Accessi"], ["uscita", "Uscite"], ["accesso_non_riuscito", "Non riusciti"]].map(([v, l]) => (
            <button key={v} onClick={() => setEvento(v)} style={{ ...btnMini, ...(evento === v ? { background: C.green, color: C.white, borderColor: C.green } : {}) }}>{l}</button>
          ))}
        </div>
        <button onClick={esporta} disabled={!righe?.length} style={btnMini}>Esporta CSV</button>
      </div>
      {errore && <div style={{ color: C.red, fontSize: 13 }}>{errore}</div>}
      <div style={riquadroTabella}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 760 }}>
          <thead>
            <tr style={intest}>
              <ThOrdinabile ord={ord} chiave="data" style={th}>Data e ora</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="utente" style={th}>Utente</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="ruolo" style={th}>Ruolo</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="evento" style={th}>Evento</ThOrdinabile>
              <th style={th}>Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            {righe === null && <tr><td colSpan={5} style={{ ...td, color: C.grafite }}>Caricamento…</td></tr>}
            {righe?.length === 0 && <tr><td colSpan={5} style={{ ...td, color: C.grafite }}>Nessun evento nel periodo scelto.</td></tr>}
            {ord.ordinate.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{dataOra(r.avvenuto_il)}</td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{r.nome_completo || r.email || "—"}</div>
                  {r.nome_completo && <div style={{ fontSize: 11.5, color: C.grafite }}>{r.email}</div>}
                </td>
                <td style={td}>{RUOLI[r.ruolo]?.short || r.ruolo || "—"}</td>
                <td style={{ ...td, fontWeight: 600, color: r.evento === "accesso_non_riuscito" ? C.ocra : r.evento === "accesso" ? C.green : C.ink }}>{EVENTI[r.evento] || r.evento}</td>
                <td style={{ ...td, color: C.grafite }}>{dettaglioAccesso(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {righe?.length >= limite && <button onClick={() => setLimite((l) => l + 1000)} style={{ ...btnMini, justifySelf: "start" }}>Carica eventi meno recenti</button>}
    </section>
  );
}

// Testo del dettaglio di un evento di accesso.
function dettaglioAccesso(r) {
  const d = r.dettaglio || {};
  if (r.evento === "accesso") return d.modo === "recupero password" ? "dal link di recupero della password" : "con email e password";
  if (r.evento === "uscita") return d.minuti_collegato != null ? `dopo ${d.minuti_collegato} min di collegamento` : "";
  if (r.evento === "accesso_non_riuscito") return d.utente_esistente ? "password errata" : "email non registrata";
  return "";
}

/* Scheda 3: operazioni dell'audit trail. Props: utente (id o ""), dal, al. */
function SchedaOperazioni({ utente, dal, al }) {
  const [righe, setRighe] = useState(null);
  const [testo, setTesto] = useState("");
  const [limite, setLimite] = useState(500);
  const [errore, setErrore] = useState("");
  useEffect(() => {
    setRighe(null);
    auditOperazioniUtente({ utente: utente || null, dal: inizioGiorno(dal), al: dopoGiorno(al), limite }).then(({ data, error }) => {
      setErrore(error ? error.message : "");
      setRighe(data || []);
    });
  }, [utente, dal, al, limite]);
  // Ricerca nel browser su operazione, oggetto, pratica, stati, motivazione, utente.
  const filtrate = useMemo(() => {
    const q = testo.trim().toLowerCase();
    const r = righe || [];
    if (!q) return r;
    return r.filter((e) => [e.operazione, e.oggetto_tipo, e.pratica, e.stato_precedente, e.stato_successivo, e.motivazione, e.nome_completo, e.email, e.dettaglio?.nome].some((v) => (v || "").toLowerCase().includes(q)));
  }, [righe, testo]);
  const ord = useOrdinamento(filtrate, {
    data: (e) => e.avvenuto_il, utente: (e) => e.nome_completo || e.email || "sistema", operazione: (e) => e.operazione,
    oggetto: (e) => e.oggetto_tipo, pratica: (e) => e.pratica, stati: (e) => [e.stato_precedente, e.stato_successivo].filter(Boolean).join(" → "), motivazione: (e) => e.motivazione,
  });

  function esporta() {
    scaricaTesto(
      `Audit_trail_user_operazioni_${dal}_${al}.csv`,
      scriviCsv(
        ["Data e ora", "Nome", "Email", "Ruolo", "Operazione", "Oggetto", "Pratica", "Da", "A", "Motivazione"],
        ord.ordinate.map((e) => [dataOra(e.avvenuto_il), e.nome_completo || "", e.email || (e.utente_id ? "" : "sistema"), e.ruolo || "", e.operazione, descrizioneOggetto(e), e.pratica || "", e.stato_precedente || "", e.stato_successivo || "", e.motivazione || ""])
      )
    );
  }

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca per operazione, pratica, documento, motivazione…" aria-label="Cerca nelle operazioni" style={{ ...campo, width: "100%", maxWidth: 440 }} />
        <button onClick={esporta} disabled={!filtrate.length} style={btnMini}>Esporta CSV</button>
      </div>
      {errore && <div style={{ color: C.red, fontSize: 13 }}>{errore}</div>}
      <div style={riquadroTabella}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 980 }}>
          <thead>
            <tr style={intest}>
              <ThOrdinabile ord={ord} chiave="data" style={th}>Data e ora</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="utente" style={th}>Utente</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="operazione" style={th}>Operazione</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="oggetto" style={th}>Oggetto</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="pratica" style={th}>Pratica</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="stati" style={th}>Da → A</ThOrdinabile>
              <ThOrdinabile ord={ord} chiave="motivazione" style={th}>Motivazione</ThOrdinabile>
            </tr>
          </thead>
          <tbody>
            {righe === null && <tr><td colSpan={7} style={{ ...td, color: C.grafite }}>Caricamento…</td></tr>}
            {righe && filtrate.length === 0 && <tr><td colSpan={7} style={{ ...td, color: C.grafite }}>Nessuna operazione nel periodo scelto.</td></tr>}
            {ord.ordinate.map((e) => (
              <tr key={e.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{dataOra(e.avvenuto_il)}</td>
                <td style={td}>
                  {/* Senza utente l'operazione è del sistema (SQL Editor, funzioni automatiche). */}
                  <div style={{ fontWeight: 600 }}>{e.nome_completo || e.email || (e.utente_id ? "utente non più presente" : "sistema")}</div>
                  {e.ruolo && <div style={{ fontSize: 11.5, color: C.grafite }}>{RUOLI[e.ruolo]?.short || e.ruolo}</div>}
                </td>
                <td style={{ ...td, fontWeight: 600 }}>{e.operazione}</td>
                <td style={td}>{descrizioneOggetto(e)}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{e.pratica || "—"}</td>
                <td style={td}>{e.stato_precedente || e.stato_successivo ? <>{e.stato_precedente || "—"} → {e.stato_successivo || "—"}</> : "—"}</td>
                <td style={td}>{e.motivazione || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {righe?.length >= limite && <button onClick={() => setLimite((l) => l + 1000)} style={{ ...btnMini, justifySelf: "start" }}>Carica operazioni meno recenti</button>}
    </section>
  );
}

// Oggetto dell'operazione: tipo e, per i documenti, nome del file.
function descrizioneOggetto(e) {
  const nome = e.dettaglio?.nome;
  const tipo = (e.oggetto_tipo || "—").replace(/_/g, " ");
  return nome && typeof nome === "string" ? `${tipo}: ${nome}` : tipo;
}

/* Riquadro numerico. Props: titolo, valore, colore. */
function Riquadro({ titolo, valore, colore = C.ink }) {
  return (
    <div style={{ ...riquadro, padding: "12px 14px" }}>
      <div style={{ fontFamily: "'Archivo'", fontSize: 24, fontWeight: 700, color: colore }}>{valore}</div>
      <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>{titolo}</div>
    </div>
  );
}

// Stili.
const riquadro = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 };
const riquadroTabella = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, overflowX: "auto" };
const intest = { textAlign: "left", color: C.grafite, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 };
const th = { padding: "10px 9px", fontWeight: 700 };
const td = { padding: "9px 9px", verticalAlign: "top" };
const tdNum = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const lbl = { display: "grid", gap: 4, fontSize: 12, fontWeight: 600, color: C.grafite };
const campo = { padding: "7px 9px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, background: C.white, boxSizing: "border-box" };
const btnMini = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: C.ink };
const btnLink = { background: "none", border: "none", color: C.green, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: "0 8px 0 0" };
