/* =========================================================================
   UtenzeCalcolo
   Scopo: passo «5a. Utenze del calcolo» del calcolo dei crediti: gestione
     della Banca Dati Utenze per utenza (richieste di Luca Moretti del
     22/10/2026). Due tabelle, utenze domestiche e non domestiche, ciascuna
     con ricerca, pagine da 50, e un modulo per ogni utenza (nuova o da
     modificare): codice, nome del capofamiglia o ragione sociale,
     indirizzo, categoria tariffaria e categoria di simulazione (proposta
     uguale alla tariffaria e modificabile), componenti (domestiche), mq,
     produzione totale, kg e svuotamenti per frazione.
     Caricamento dell'elenco completo dell'anno dal modello Excel «Banca
     dati utenze CWP» (o ZIP di CSV): anteprima con errori e avvisi, poi
     «Sostituisci l'elenco»; un file con righe sbagliate non si carica.
   Usato da: src/pages/CalcoloCrediti.jsx.
   Props: calcoloId, sola (calcolo confermato: solo lettura), onCambio()
     dopo ogni modifica (la pagina rilegge la testata: il risultato della
     bozza viene azzerato dal database).
   Dati: src/lib/crediti/utenzeCalcolo.js (database) e
     src/lib/crediti/bancaDatiUtenze.js (lettura del file, controlli).
   Sicurezza: la pagina del calcolo è solo per gli Amministratori; il
     database registra nell'audit ogni consultazione dell'elenco
     (dati personali), ogni caricamento, modifica e cancellazione.
   Telefono: le tabelle diventano schede (classe «tabella-schede»), il
     modulo occupa lo schermo.
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import { FRAZIONI_BDU, controllaUtenza, leggiBancaDati, riepilogoUtenza } from "../../lib/crediti/bancaDatiUtenze.js";
import { contaUtenze, elencaUtenze, salvaUtenza, eliminaUtenza, svuotaUtenze, sostituisciUtenze } from "../../lib/crediti/utenzeCalcolo.js";

const PER_PAGINA = 50;
const fmt = (v, d = 0) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }));
const NOMI = { UD: "Utenze domestiche", UnD: "Utenze non domestiche" };

export default function UtenzeCalcolo({ calcoloId, sola, onCambio }) {
  const [tipo, setTipo] = useState("UD");
  const [conteggi, setConteggi] = useState(null);
  const [cerca, setCerca] = useState("");
  const [cercaAttiva, setCercaAttiva] = useState("");
  const [pagina, setPagina] = useState(0);
  const [righe, setRighe] = useState([]);
  const [totale, setTotale] = useState(0);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");
  // Modulo aperto: { id (null = nuova), utenza } oppure null.
  const [modulo, setModulo] = useState(null);
  // Anteprima del file: { nome, esito } oppure null; avanzamento del caricamento.
  const [anteprima, setAnteprima] = useState(null);
  const [avanzamento, setAvanzamento] = useState("");

  async function leggiConteggi() {
    const { data } = await contaUtenze(calcoloId);
    setConteggi(data);
  }
  async function leggiPagina() {
    setCaricamento(true);
    const { data, totale: t, error } = await elencaUtenze(calcoloId, { cerca: cercaAttiva, tipo, da: pagina * PER_PAGINA, quanti: PER_PAGINA });
    if (error) setErrore(error.message);
    setRighe(data);
    setTotale(t);
    setCaricamento(false);
  }
  useEffect(() => { leggiConteggi(); }, [calcoloId]);
  useEffect(() => { leggiPagina(); }, [calcoloId, tipo, pagina, cercaAttiva]);

  // Dopo ogni modifica: rilegge conteggi e pagina e avvisa la pagina del calcolo.
  async function aggiorna(testo) {
    setMessaggio(testo || "");
    await Promise.all([leggiConteggi(), leggiPagina()]);
    onCambio && onCambio();
  }

  async function scegliFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErrore(""); setMessaggio("");
    try {
      const esito = await leggiBancaDati(await f.arrayBuffer(), f.name);
      setAnteprima({ nome: f.name, esito });
    } catch (err) {
      setErrore(err.message);
    }
  }
  async function confermaCaricamento() {
    const { esito } = anteprima;
    setAvanzamento("Caricamento… 0 utenze");
    const { error } = await sostituisciUtenze(calcoloId, esito.utenze, (n, t) => setAvanzamento(`Caricamento… ${fmt(n)} di ${fmt(t)} utenze`));
    setAvanzamento("");
    if (error) { setErrore(error.message); await aggiorna(); return; }
    setAnteprima(null);
    setPagina(0);
    await aggiorna(`Elenco caricato: ${fmt(esito.conteggi.UD)} utenze domestiche e ${fmt(esito.conteggi.UnD)} non domestiche.`);
  }
  async function svuota() {
    if (!window.confirm("Togliere tutte le utenze di questo calcolo? Resta traccia nell'audit.")) return;
    const { error } = await svuotaUtenze(calcoloId, "elenco svuotato dal portale");
    if (error) return setErrore(error.message);
    setPagina(0);
    await aggiorna("Elenco svuotato.");
  }
  function nuova() {
    setModulo({ id: null, utenza: { codice: "", tipo, nominativo: "", indirizzo: "", componenti: null, mq: null, categoria_tariffaria: "", categoria_simulazione: "", produzione_totale_kg: null, frazioni: { indifferenziato: { kg: null } } } });
  }

  const n = conteggi?.[tipo]?.utenze ?? 0;
  const senza = (conteggi?.UD?.senzaCategoria || 0) + (conteggi?.UnD?.senzaCategoria || 0);
  const pagine = Math.max(1, Math.ceil(totale / PER_PAGINA));

  return (
    <div>
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 4px" }}>5a. Utenze del calcolo</h2>
      <p style={{ fontSize: 12.5, color: C.grafite, margin: "0 0 12px" }}>
        Elenco completo delle utenze dell'anno, una riga per utenza, caricato ogni anno dal modello «Banca dati utenze CWP».
        Contiene dati personali: ogni consultazione e ogni modifica sono registrate nell'Audit.
      </p>

      {/* Riquadri: numeri per tipo e utenze senza categoria di simulazione */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Numero valore={conteggi ? fmt(conteggi.UD.utenze) : "…"} etichetta="Utenze domestiche" />
        <Numero valore={conteggi ? fmt(conteggi.UnD.utenze) : "…"} etichetta="Utenze non domestiche" />
        <Numero valore={conteggi ? fmt(senza) : "…"} etichetta="Senza categoria di simulazione" colore={senza ? C.ocra : C.ink} />
      </div>

      {!sola && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label style={{ ...btnPrimario, display: "inline-flex", alignItems: "center" }}>
            Carica il file dell'anno
            <input type="file" accept=".xlsx,.zip" onChange={scegliFile} style={{ display: "none" }} />
          </label>
          <a href="/modelli/Banca_dati_utenze_CWP_v1.xlsx" download style={{ ...btnMini, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Scarica il modello Excel</a>
          {(conteggi?.UD.utenze || conteggi?.UnD.utenze) ? <button onClick={svuota} style={{ ...btnMini, color: C.red }}>Svuota l'elenco</button> : null}
        </div>
      )}

      {anteprima && (
        <div style={{ border: `1px solid ${anteprima.esito.errori.length ? C.red : C.green}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12, background: anteprima.esito.errori.length ? "#FBE9E7" : C.greenSoft }}>
          <b>{anteprima.nome}</b>
          {anteprima.esito.errori.length ? (
            <>
              <div style={{ color: C.red, fontSize: 13, margin: "6px 0" }}>File non caricato: correggete queste righe e caricatelo di nuovo. L'elenco attuale non cambia.</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>{anteprima.esito.errori.map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          ) : (
            <div style={{ fontSize: 13, margin: "6px 0" }}>
              {fmt(anteprima.esito.conteggi.UD)} utenze domestiche e {fmt(anteprima.esito.conteggi.UnD)} non domestiche pronte.
              Il caricamento <b>sostituisce</b> l'elenco attuale del calcolo.
            </div>
          )}
          {anteprima.esito.avvisi.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, color: C.ocra }}>{anteprima.esito.avvisi.map((a) => <li key={a}>{a}</li>)}</ul>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {!anteprima.esito.errori.length && (
              <button onClick={confermaCaricamento} disabled={!!avanzamento} style={btnPrimario}>
                Sostituisci l'elenco ({fmt(anteprima.esito.utenze.length)} utenze)
              </button>
            )}
            <button onClick={() => setAnteprima(null)} disabled={!!avanzamento} style={btnMini}>Annulla</button>
            {avanzamento && <span style={{ fontSize: 12.5, color: C.grafite, alignSelf: "center" }}>{avanzamento}</span>}
          </div>
        </div>
      )}

      {errore && <div role="alert" style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{errore}</div>}
      {messaggio && <div style={{ color: C.green, fontSize: 13, marginBottom: 10 }}>{messaggio}</div>}

      {/* Schede Domestiche / Non domestiche */}
      <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {["UD", "UnD"].map((t) => (
          <button key={t} role="tab" aria-selected={tipo === t} onClick={() => { setTipo(t); setPagina(0); }}
            style={{ ...btnMini, ...(tipo === t ? { background: C.green, color: C.white, border: `1px solid ${C.green}` } : {}) }}>
            {NOMI[t]} {conteggi ? `(${fmt(conteggi[t].utenze)})` : ""}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setPagina(0); setCercaAttiva(cerca.trim()); }} style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder={`Cerca per codice, ${tipo === "UD" ? "capofamiglia" : "ragione sociale"}, indirizzo o categoria`} aria-label="Cerca utenza" style={{ ...campo, flex: "1 1 260px" }} />
        <button type="submit" style={btnMini}>Cerca</button>
        {cercaAttiva && <button type="button" onClick={() => { setCerca(""); setCercaAttiva(""); setPagina(0); }} style={btnMini}>Tutte</button>}
        {!sola && <button type="button" onClick={nuova} style={btnMini}>+ Nuova utenza {tipo === "UD" ? "domestica" : "non domestica"}</button>}
      </form>

      <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
        <table className="tabella-schede" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 820 }}>
          <thead>
            <tr style={{ background: C.paper, textAlign: "left", color: C.grafite, fontSize: 11.5 }}>
              <th style={th}>Codice</th>
              <th style={th}>{tipo === "UD" ? "Capofamiglia" : "Ragione sociale"}</th>
              <th style={th}>Indirizzo</th>
              <th style={th}>Cat. tariffaria</th>
              <th style={th}>Cat. simulazione</th>
              <th style={{ ...th, textAlign: "right" }}>{tipo === "UD" ? "Componenti · mq" : "Mq"}</th>
              <th style={{ ...th, textAlign: "right" }}>Totale (kg)</th>
              <th style={{ ...th, textAlign: "right" }}>Indifferenziato (kg)</th>
              <th style={{ ...th, textAlign: "right" }}>Differenziata</th>
            </tr>
          </thead>
          <tbody>
            {caricamento && <tr><td colSpan={9} style={{ ...td, color: C.grafite }}>Caricamento…</td></tr>}
            {!caricamento && righe.length === 0 && (
              <tr><td colSpan={9} style={{ ...td, color: C.grafite }}>{cercaAttiva ? "Nessuna utenza corrisponde alla ricerca." : n ? "" : "Nessuna utenza: caricate il file dell'anno."}</td></tr>
            )}
            {!caricamento && righe.map((u) => {
              const r = riepilogoUtenza(u);
              return (
                <tr key={u.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  {/* Il codice apre il modulo dell'utenza. */}
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => setModulo({ id: u.id, utenza: { ...u } })} title={sola ? "Apri l'utenza" : "Modifica l'utenza"}
                      style={{ background: "none", border: "none", padding: 0, minHeight: 0, color: C.green, fontWeight: 700, fontSize: 12.5, textDecoration: "underline", cursor: "pointer" }}>
                      {u.codice} ✎
                    </button>
                  </td>
                  <td style={td} data-etichetta={tipo === "UD" ? "Capofamiglia" : "Ragione sociale"}>{u.nominativo}</td>
                  <td style={td} data-etichetta="Indirizzo">{u.indirizzo}</td>
                  <td style={td} data-etichetta="Categoria tariffaria">{u.categoria_tariffaria || "—"}</td>
                  <td style={td} data-etichetta="Categoria di simulazione">
                    {u.categoria_simulazione || <span style={{ color: C.ocra, fontWeight: 600 }}>da assegnare</span>}
                    {u.categoria_simulazione && u.categoria_tariffaria && u.categoria_simulazione !== u.categoria_tariffaria && <span style={{ color: C.grafite, fontSize: 11 }}> (cambiata)</span>}
                  </td>
                  <td style={{ ...td, textAlign: "right" }} data-etichetta={tipo === "UD" ? "Componenti · mq" : "Mq"}>
                    {tipo === "UD" ? `${u.componenti ?? "—"} · ${fmt(u.mq)}` : fmt(u.mq)}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }} data-etichetta="Totale (kg)">
                    {fmt(u.produzione_totale_kg)}
                    {Math.abs(Number(u.produzione_totale_kg) - r.somma) > Math.max(1, Number(u.produzione_totale_kg) * 0.01) && (
                      <div style={{ color: C.ocra, fontSize: 11, fontWeight: 600 }} title="La produzione totale è diversa dalla somma delle frazioni">≠ somma {fmt(r.somma)}</div>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "right" }} data-etichetta="Indifferenziato (kg)">{fmt(r.indifferenziato)}</td>
                  <td style={{ ...td, textAlign: "right" }} data-etichetta="Differenziata">{r.differenziataPct == null ? "—" : `${fmt(r.differenziataPct, 1)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totale > PER_PAGINA && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12.5, color: C.grafite, flexWrap: "wrap" }}>
          <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0} style={btnMini}>← Precedenti</button>
          <span>Pagina {pagina + 1} di {pagine} · {fmt(totale)} utenze</span>
          <button onClick={() => setPagina((p) => Math.min(pagine - 1, p + 1))} disabled={pagina >= pagine - 1} style={btnMini}>Successive →</button>
        </div>
      )}

      {modulo && (
        <ModuloUtenza
          calcoloId={calcoloId}
          iniziale={modulo}
          sola={sola}
          onChiudi={() => setModulo(null)}
          onSalvata={async (testo) => { setModulo(null); await aggiorna(testo); }}
        />
      )}
    </div>
  );
}

function Numero({ valore, etichetta, colore = C.ink }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px", background: C.white }}>
      <div style={{ fontFamily: "'Archivo'", fontSize: 22, fontWeight: 800, color: colore }}>{valore}</div>
      <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>{etichetta}</div>
    </div>
  );
}

/* Modulo di una utenza (nuova o esistente), sovrapposto alla pagina.
   Props: calcoloId, iniziale { id, utenza }, sola, onChiudi(), onSalvata(testo).
   I numeri si scrivono anche con la virgola. La categoria di simulazione
   segue la tariffaria finché non la si cambia a mano (proposta). */
function ModuloUtenza({ calcoloId, iniziale, sola, onChiudi, onSalvata }) {
  const ud = iniziale.utenza.tipo === "UD";
  const testo = (v) => (v == null ? "" : String(v).replace(".", ","));
  const [f, setF] = useState(() => {
    const u = iniziale.utenza;
    const fr = {};
    FRAZIONI_BDU.forEach(([id]) => { fr[id] = { kg: testo(u.frazioni?.[id]?.kg), sv: testo(u.frazioni?.[id]?.svuotamenti) }; });
    return {
      codice: u.codice || "", nominativo: u.nominativo || "", indirizzo: u.indirizzo || "",
      componenti: testo(u.componenti), mq: testo(u.mq),
      categoria_tariffaria: u.categoria_tariffaria || "", categoria_simulazione: u.categoria_simulazione || "",
      produzione_totale_kg: testo(u.produzione_totale_kg), frazioni: fr,
    };
  });
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  const num = (s) => {
    const t = String(s ?? "").trim().replace(/\s/g, "");
    if (!t) return null;
    const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
    return Number.isFinite(n) ? n : NaN;
  };
  // Utenza nel formato del database, dai campi del modulo.
  function utenza() {
    const frazioni = {};
    FRAZIONI_BDU.forEach(([id]) => {
      const kg = num(f.frazioni[id].kg);
      const sv = num(f.frazioni[id].sv);
      if (kg === null) return;
      frazioni[id] = sv === null ? { kg } : { kg, svuotamenti: sv };
    });
    return {
      codice: f.codice.trim(), tipo: iniziale.utenza.tipo, nominativo: f.nominativo.trim(), indirizzo: f.indirizzo.trim(),
      componenti: ud ? num(f.componenti) : null, mq: num(f.mq),
      categoria_tariffaria: f.categoria_tariffaria.trim() || null, categoria_simulazione: f.categoria_simulazione.trim() || null,
      produzione_totale_kg: num(f.produzione_totale_kg), frazioni,
    };
  }
  const u = utenza();
  const svSenzaKg = FRAZIONI_BDU.filter(([id]) => num(f.frazioni[id].kg) === null && num(f.frazioni[id].sv) !== null).map(([, nome]) => nome);
  const esito = controllaUtenza(u);
  const errori = [...esito.errori, ...svSenzaKg.map((n) => `svuotamenti di ${n} senza i kg`)];
  const somma = riepilogoUtenza(u).somma;

  const cambia = (k, v) => setF((x) => ({ ...x, [k]: v }));
  // La categoria di simulazione segue la tariffaria finché è vuota o uguale.
  const cambiaTariffaria = (v) => setF((x) => ({
    ...x, categoria_tariffaria: v,
    categoria_simulazione: !x.categoria_simulazione || x.categoria_simulazione === x.categoria_tariffaria ? v : x.categoria_simulazione,
  }));
  const cambiaFrazione = (id, k, v) => setF((x) => ({ ...x, frazioni: { ...x.frazioni, [id]: { ...x.frazioni[id], [k]: v } } }));

  async function salva() {
    if (errori.length) return setErrore("Correggete i campi indicati.");
    setInCorso(true); setErrore("");
    const { error } = await salvaUtenza(calcoloId, iniziale.id, u);
    setInCorso(false);
    if (error) return setErrore(error.message);
    onSalvata(`Utenza ${u.codice} ${iniziale.id ? "aggiornata" : "aggiunta"}.`);
  }
  async function elimina() {
    if (!window.confirm(`Eliminare l'utenza ${iniziale.utenza.codice}? Resta traccia nell'audit.`)) return;
    setInCorso(true);
    const { error } = await eliminaUtenza(iniziale.id);
    setInCorso(false);
    if (error) return setErrore(error.message);
    onSalvata(`Utenza ${iniziale.utenza.codice} eliminata.`);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Utenza" className="modulo-utenza-sfondo" style={{ position: "fixed", inset: 0, background: "rgba(27,33,24,0.45)", zIndex: 70, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "28px 12px", overflowY: "auto" }}>
      <div className="modulo-utenza" style={{ background: C.white, borderRadius: 14, width: "min(760px, 100%)", padding: "18px 20px", boxShadow: "0 16px 40px rgba(27,33,24,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <h3 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: 0 }}>
            {iniziale.id ? (sola ? "Utenza" : "Modifica utenza") : "Nuova utenza"} {ud ? "domestica" : "non domestica"}
          </h3>
          <button onClick={onChiudi} style={btnMini} aria-label="Chiudi">✕</button>
        </div>
        <fieldset disabled={sola || inCorso} style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, alignItems: "start" }}>
            <label style={lbl}>Codice utenza *<input value={f.codice} onChange={(e) => cambia("codice", e.target.value)} style={campo} /></label>
            <label style={lbl}>{ud ? "Nome capofamiglia *" : "Ragione sociale *"}<input value={f.nominativo} onChange={(e) => cambia("nominativo", e.target.value)} style={campo} /></label>
            <label style={{ ...lbl, gridColumn: "1 / -1" }}>Indirizzo *<input value={f.indirizzo} onChange={(e) => cambia("indirizzo", e.target.value)} style={campo} /></label>
            <label style={lbl}>Categoria tariffaria<input value={f.categoria_tariffaria} onChange={(e) => cambiaTariffaria(e.target.value)} style={campo} placeholder={ud ? "es. 3 (componenti)" : "es. 22 (ristoranti)"} /></label>
            <label style={lbl}>
              Categoria di simulazione
              <input value={f.categoria_simulazione} onChange={(e) => cambia("categoria_simulazione", e.target.value)} style={campo} placeholder="proposta = tariffaria" />
              <span style={{ fontWeight: 400, fontSize: 11 }}>Usata dal calcolo per i rifiuti attesi; proposta uguale alla tariffaria.</span>
            </label>
            {ud && <label style={lbl}>N. componenti<input inputMode="numeric" value={f.componenti} onChange={(e) => cambia("componenti", e.target.value)} style={campo} /></label>}
            <label style={lbl}>{ud ? "Mq abitazione" : "Mq locali"}<input inputMode="decimal" value={f.mq} onChange={(e) => cambia("mq", e.target.value)} style={campo} /></label>
            <label style={lbl}>
              Produzione totale (kg) *
              <input inputMode="decimal" value={f.produzione_totale_kg} onChange={(e) => cambia("produzione_totale_kg", e.target.value)} style={campo} />
              {!sola && <button type="button" onClick={() => cambia("produzione_totale_kg", String(somma).replace(".", ","))} style={{ ...btnMini, padding: "3px 8px", fontSize: 11.5, justifySelf: "start" }}>= somma delle frazioni ({fmt(somma)} kg)</button>}
            </label>
          </div>

          <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 700 }}>Frazioni dell'anno</div>
          <div style={{ fontSize: 11.5, color: C.grafite, marginBottom: 6 }}>Vuoto = frazione non raccolta o non misurata. Indifferenziato obbligatorio (anche 0).</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "6px 18px" }}>
            {[0, 1].map((col) => (
              <div key={col} className={col ? "intestazione-frazioni-2" : undefined} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: 6, alignItems: "center", fontSize: 11.5, color: C.grafite, fontWeight: 600 }}>
                <span>Frazione</span><span>kg nell'anno</span><span>Svuotamenti</span>
              </div>
            ))}
            {FRAZIONI_BDU.map(([id, nome]) => (
              <div key={id} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: 6, alignItems: "center", fontSize: 12.5 }}>
                <span style={{ fontWeight: id === "indifferenziato" ? 700 : 500 }}>{nome}{id === "indifferenziato" ? " *" : ""}</span>
                <input aria-label={`${nome}, kg`} placeholder="kg" inputMode="decimal" value={f.frazioni[id].kg} onChange={(e) => cambiaFrazione(id, "kg", e.target.value)} style={{ ...campo, padding: "6px 8px" }} />
                <input aria-label={`${nome}, svuotamenti`} placeholder="svuot." inputMode="numeric" value={f.frazioni[id].sv} onChange={(e) => cambiaFrazione(id, "sv", e.target.value)} style={{ ...campo, padding: "6px 8px" }} />
              </div>
            ))}
          </div>
        </fieldset>

        {(errori.length > 0 || esito.avvisi.length > 0) && (
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
            {errori.map((e) => <li key={e} style={{ color: C.red }}>{e}</li>)}
            {esito.avvisi.map((a) => <li key={a} style={{ color: C.ocra }}>{a}</li>)}
          </ul>
        )}
        {errore && <div role="alert" style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{errore}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {!sola && <button onClick={salva} disabled={inCorso || errori.length > 0} style={{ ...btnPrimario, opacity: errori.length ? 0.55 : 1 }}>Salva</button>}
          <button onClick={onChiudi} style={btnMini}>{sola ? "Chiudi" : "Annulla"}</button>
          {!sola && iniziale.id && <button onClick={elimina} disabled={inCorso} style={{ ...btnMini, color: C.red, marginLeft: "auto" }}>Elimina utenza</button>}
        </div>
      </div>
    </div>
  );
}

const lbl = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600 };
const campo = { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", background: C.white, color: C.ink };
const btnPrimario = { background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "8px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnMini = { background: C.white, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const th = { padding: "9px 10px", fontWeight: 700 };
const td = { padding: "8px 10px", verticalAlign: "top" };
