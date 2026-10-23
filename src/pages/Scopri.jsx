/* =========================================================================
   Scopri — landing page PUBBLICA delle campagne di marketing: indirizzi
   «/scopri?c=<codice>» (link «Approfondisci» dell'email) e
   «/scopri/disiscrizione?c=<codice>» (non ricevere altre comunicazioni).
   Richiesta di Luca Moretti del 23/10/2026.

   Contenuto:
   - presentazione del Programma (risorse per 7, 10 o 21 anni, vantaggi);
   - micro simulazione: abitanti, produzione totale e secco residuo
     (tonnellate all'anno), durata, listino (Caso 1 volontario o Caso 2 da
     bando di gara) → crediti, ricavi, costi e margine anno per anno con
     grafico (microSimulazione di src/lib/marketing.js, motore del
     simulatore); ipotesi sempre visibili;
   - fascicolo informativo in PDF da scaricare
     (public/marketing/Fascicolo_Carbon_WastePrint.pdf);
   - richiesta di registrazione: inviata a tutti gli Amministratori
     (notifica nel portale ed email) dalla funzione del server «marketing».
   Nessun accesso richiesto: la pagina conosce solo il codice casuale
   dell'invio, con cui legge il nome dell'ente e segna visita, simulazione
   e richiesta. Campo trappola contro i robot; limiti di invio nel server.
   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { COLORI as C } from "../lib/cwpProgram.js";
import { microSimulazione } from "../lib/marketing.js";
import { azionePubblica } from "../lib/marketingDati.js";

const euro = (v) => "€ " + Math.round(Number(v || 0)).toLocaleString("it-IT");
const num = (v) => Math.round(Number(v || 0)).toLocaleString("it-IT");

function Testata() {
  return (
    <header style={{ background: C.white, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <img src="/loghi/carbonwasteprint.png" alt="Carbon WastePrint" style={{ height: 46 }} />
        <img src="/loghi/fondazione-operate.png" alt="Fondazione Operate" style={{ height: 34 }} />
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: C.grafite }}>Programma Carbon WastePrint®</span>
      </div>
    </header>
  );
}

export function Disiscrizione() {
  const [params] = useSearchParams();
  const token = params.get("c") || "";
  const [esito, setEsito] = useState(null);
  async function conferma() {
    const { error } = await azionePubblica("disiscrivi", { token });
    setEsito(error ? { errore: true, testo: error.message } : { testo: "Fatto: questo indirizzo non riceverà altre comunicazioni del Programma." });
  }
  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Testata />
      <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px" }}>
        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24 }}>
          <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 8px" }}>Non ricevere altre comunicazioni</h1>
          <p style={{ fontSize: 14, color: C.grafite, lineHeight: 1.5 }}>Confermando, l'indirizzo a cui è arrivata l'email non riceverà più le comunicazioni del Programma Carbon WastePrint® della Fondazione Operate.</p>
          {esito ? <p style={{ color: esito.errore ? C.red : C.green, fontWeight: 600 }}>{esito.testo}</p> : <button onClick={conferma} disabled={!token} style={bottone}>Conferma</button>}
        </div>
      </main>
    </div>
  );
}

export default function Scopri() {
  const [params] = useSearchParams();
  const token = params.get("c") || "";
  const [ente, setEnte] = useState(null);
  const [form, setForm] = useState({ abitanti: "", totale: "", secco: "", anni: 10, caso: "caso1" });
  const [risultato, setRisultato] = useState(null);
  const [richiesta, setRichiesta] = useState({ ente: "", referente: "", ruolo: "", email: "", telefono: "", messaggio: "", consenso: false, sito_web: "" });
  const [esito, setEsito] = useState(null);
  const [invio, setInvio] = useState(false);

  // Nome e abitanti dell'ente dal codice dell'invio (se c'è).
  useEffect(() => {
    document.title = "Il tuo Comune e il Programma Carbon WastePrint";
    if (!token) return;
    azionePubblica("visita", { token }).then(({ data }) => {
      if (!data?.ente) return;
      setEnte(data);
      if (data.popolazione) setForm((f) => ({ ...f, abitanti: String(data.popolazione) }));
      setRichiesta((r) => ({ ...r, ente: data.ente }));
    });
  }, [token]);

  function simula(e) {
    e.preventDefault();
    const r = microSimulazione(form);
    setRisultato(r);
    if (!r.errori?.length) {
      if (token) azionePubblica("simulata", { token });
      setTimeout(() => document.getElementById("risultati")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  async function inviaRichiesta(e) {
    e.preventDefault();
    setEsito(null);
    if (!richiesta.consenso) { setEsito({ errore: true, testo: "Serve il consenso al trattamento dei dati per essere ricontattati." }); return; }
    setInvio(true);
    const simulazione = risultato?.totali ? { abitanti: Number(form.abitanti), anni_durata: Number(form.anni), caso: risultato.caso, totali: risultato.totali } : null;
    const { error } = await azionePubblica("richiesta", { token: token || null, ...richiesta, simulazione });
    setInvio(false);
    setEsito(error ? { errore: true, testo: error.message } : { testo: "Richiesta inviata. La Fondazione ti ricontatterà al più presto per la registrazione del Comune." });
  }

  const nomeEnte = ente?.ente;
  return (
    <div style={{ background: C.paper, minHeight: "100vh", color: C.ink }}>
      <Testata />
      {/* Presentazione */}
      <section style={{ background: `linear-gradient(120deg, #1f4a2b, ${C.green} 60%, #4f7d4a)`, color: C.white }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 36px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 26, alignItems: "center" }}>
          <div>
            {nomeEnte && <div style={{ fontSize: 14, color: "#dfe9db", marginBottom: 6 }}>Per {nomeEnte}</div>}
            <h1 style={{ fontFamily: "'Archivo'", fontSize: "clamp(26px, 4vw, 40px)", lineHeight: 1.12, margin: "0 0 12px" }}>I rifiuti evitati diventano risorse per il tuo Comune</h1>
            <p style={{ fontSize: 16, lineHeight: 1.55, color: "#e4ede1", margin: 0 }}>
              Con il Programma Carbon WastePrint® la riduzione dei rifiuti del territorio diventa crediti di carbonio certificati, venduti sul mercato volontario: ricavi ogni anno per tutta la durata del progetto.
            </p>
            <a href="#simula" style={{ ...bottone, display: "inline-block", marginTop: 18, background: C.white, color: C.green, textDecoration: "none" }}>Simula il tuo Comune ↓</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[["7", "anni rinnovabili"], ["10", "anni"], ["21", "anni di risorse"]].map(([n, t]) => (
              <div key={n} style={{ background: "rgba(255,255,255,.95)", color: C.green, borderRadius: 14, padding: "16px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Archivo'", fontSize: 36, fontWeight: 800 }}>{n}</div>
                <div style={{ fontSize: 12.5, color: C.ink }}>{t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 20px 60px" }}>
        {/* Vantaggi */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            ["Ricavi ogni anno", "I crediti si vendono ogni anno: risorse da reinvestire nel servizio e nella tariffa."],
            ["Tariffa più equa", "Premia i cittadini e le imprese che producono meno rifiuti."],
            ["Dati misurati", "Calcolo certificato (UNI EN ISO 14064-2) e validato da un ente terzo."],
            ["Seguiti passo passo", "La Fondazione segue ogni fase; tutto è visibile dal portale del Programma."],
          ].map(([t, d]) => (
            <div key={t} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
              <b style={{ color: C.green }}>{t}</b>
              <div style={{ fontSize: 13.5, color: C.grafite, marginTop: 4, lineHeight: 1.45 }}>{d}</div>
            </div>
          ))}
        </div>

        {/* Simulazione */}
        <section id="simula" style={sezione}>
          <h2 style={h2}>Simula costi e ricavi del tuo Comune</h2>
          <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 14px" }}>Bastano quattro dati dell'ultimo anno (li trovi nel Catasto rifiuti ISPRA o nel piano finanziario del servizio).</p>
          <form onSubmit={simula} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12, alignItems: "end" }}>
            <Campo etichetta="Abitanti" valore={form.abitanti} onChange={(v) => setForm({ ...form, abitanti: v })} />
            <Campo etichetta="Rifiuti totali (tonnellate all'anno)" valore={form.totale} onChange={(v) => setForm({ ...form, totale: v })} />
            <Campo etichetta="Secco residuo (tonnellate all'anno)" valore={form.secco} onChange={(v) => setForm({ ...form, secco: v })} />
            <div>
              <div style={etichetta}>Durata del progetto</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[7, 10, 21].map((a) => (
                  <button type="button" key={a} onClick={() => setForm({ ...form, anni: a })} aria-pressed={form.anni === a} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${form.anni === a ? C.green : C.line}`, background: form.anni === a ? C.green : C.white, color: form.anni === a ? C.white : C.ink, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{a} anni</button>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={etichetta}>Il progetto nasce…</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 14 }}>
                <label><input type="radio" name="caso" checked={form.caso === "caso1"} onChange={() => setForm({ ...form, caso: "caso1" })} /> per scelta del Comune (Caso 1, progetto volontario)</label>
                <label><input type="radio" name="caso" checked={form.caso === "caso2"} onChange={() => setForm({ ...form, caso: "caso2" })} /> da un bando di gara (Caso 2)</label>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}><button type="submit" style={bottone}>Calcola</button></div>
          </form>
          {risultato?.errori?.length > 0 && (
            <ul style={{ color: C.red, fontSize: 13.5, margin: "12px 0 0", paddingLeft: 18 }}>{risultato.errori.map((e) => <li key={e}>{e}</li>)}</ul>
          )}
        </section>

        {risultato?.totali && <Risultati r={risultato} anni={form.anni} />}

        {/* Fascicolo */}
        <section style={{ ...sezione, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px" }}>
            <h2 style={{ ...h2, marginBottom: 4 }}>Il Programma in breve</h2>
            <p style={{ fontSize: 13.5, color: C.grafite, margin: 0, lineHeight: 1.5 }}>Fascicolo informativo: cos'è il Programma Carbon WastePrint®, come funziona per il Comune, il portale e alcuni esempi di ritorni economici.</p>
          </div>
          <a href="/marketing/Fascicolo_Carbon_WastePrint.pdf" target="_blank" rel="noreferrer" style={{ ...bottone, textDecoration: "none" }}>Scarica il fascicolo (PDF)</a>
        </section>

        {/* Richiesta di registrazione */}
        <section id="registrazione" style={sezione}>
          <h2 style={h2}>Chiedi la registrazione del tuo Comune</h2>
          <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 14px" }}>La Fondazione ti ricontatta per verificare i dati e avviare il percorso. Nessun impegno.</p>
          {esito && !esito.errore ? (
            <div style={{ background: "#e4ede1", borderRadius: 10, padding: 14, color: C.green, fontWeight: 600 }}>{esito.testo}</div>
          ) : (
            <form onSubmit={inviaRichiesta} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12 }}>
              <Campo etichetta="Comune o ente *" valore={richiesta.ente} onChange={(v) => setRichiesta({ ...richiesta, ente: v })} testo />
              <Campo etichetta="Nome e cognome *" valore={richiesta.referente} onChange={(v) => setRichiesta({ ...richiesta, referente: v })} testo />
              <Campo etichetta="Ruolo (es. Responsabile tributi)" valore={richiesta.ruolo} onChange={(v) => setRichiesta({ ...richiesta, ruolo: v })} testo />
              <Campo etichetta="Email *" valore={richiesta.email} onChange={(v) => setRichiesta({ ...richiesta, email: v })} testo tipo="email" />
              <Campo etichetta="Telefono" valore={richiesta.telefono} onChange={(v) => setRichiesta({ ...richiesta, telefono: v })} testo tipo="tel" />
              {/* Campo trappola: nascosto alle persone, compilato dai robot. */}
              <input name="sito_web" tabIndex={-1} autoComplete="off" value={richiesta.sito_web} onChange={(e) => setRichiesta({ ...richiesta, sito_web: e.target.value })} style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
              <label style={{ ...etichetta, gridColumn: "1 / -1", display: "grid", gap: 4 }}>Messaggio
                <textarea rows={3} value={richiesta.messaggio} onChange={(e) => setRichiesta({ ...richiesta, messaggio: e.target.value })} style={{ ...campoStile, resize: "vertical" }} />
              </label>
              <label style={{ gridColumn: "1 / -1", fontSize: 13, lineHeight: 1.45, color: C.grafite, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input type="checkbox" checked={richiesta.consenso} onChange={(e) => setRichiesta({ ...richiesta, consenso: e.target.checked })} style={{ marginTop: 3 }} />
                <span>Acconsento al trattamento dei dati indicati da parte di Fondazione Operate per essere ricontattato sul Programma Carbon WastePrint® (i dati non sono ceduti a terzi).{risultato?.totali ? " Insieme alla richiesta invio i risultati della simulazione." : ""}</span>
              </label>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" disabled={invio} style={bottone}>{invio ? "Invio…" : "Invia la richiesta"}</button>
                {esito?.errore && <span style={{ color: C.red, fontSize: 13.5 }}>{esito.testo}</span>}
              </div>
            </form>
          )}
        </section>
        <div style={{ fontSize: 12, color: C.grafite, textAlign: "center", marginTop: 24 }}>
          Fondazione Operate · Programma Carbon WastePrint® · <a href="/programma" style={{ color: C.green }}>Il Programma</a> · info@carbonwasteprint.com
          {token && <> · <a href={`/scopri/disiscrizione?c=${encodeURIComponent(token)}`} style={{ color: C.grafite }}>Non ricevere altre comunicazioni</a></>}
        </div>
      </main>
    </div>
  );
}

/* Risultati della micro simulazione: riquadri, grafico, tabella, ipotesi. */
function Risultati({ r, anni }) {
  const t = r.totali;
  const [tabella, setTabella] = useState(false);
  return (
    <section id="risultati" style={sezione}>
      <h2 style={h2}>In {anni} anni il tuo Comune potrebbe ottenere</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10, marginBottom: 18 }}>
        <Riquadro grande etichetta="Margine netto per il Comune" valore={euro(t.margine)} />
        <Riquadro etichetta="Ricavi dalla vendita dei crediti" valore={euro(t.ricavi)} />
        <Riquadro etichetta={`Costi (${r.caso === "caso2" ? "Caso 2" : "Caso 1"})`} valore={euro(t.costi)} />
        <Riquadro etichetta="Crediti di carbonio" valore={num(t.crediti)} />
        <Riquadro etichetta="Per abitante, nel periodo" valore={`€ ${Number(t.perAbitante).toLocaleString("it-IT", { maximumFractionDigits: 2 })}`} />
        <Riquadro etichetta="Margine positivo dal" valore={t.rientro ? String(t.rientro) : "—"} />
      </div>
      <Grafico righe={r.anni} />
      <button onClick={() => setTabella((v) => !v)} style={{ ...bottoneSecondario, marginTop: 12 }}>{tabella ? "Nascondi" : "Mostra"} i valori anno per anno</button>
      {tabella && (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
            <thead><tr style={{ textAlign: "right", color: C.grafite, fontSize: 12 }}><th style={{ textAlign: "left", padding: 6 }}>Anno</th><th style={{ padding: 6 }}>Crediti</th><th style={{ padding: 6 }}>Ricavi</th><th style={{ padding: 6 }}>Costi</th><th style={{ padding: 6 }}>Margine</th><th style={{ padding: 6 }}>Cumulato</th></tr></thead>
            <tbody>
              {r.anni.map((a) => (
                <tr key={a.anno} style={{ borderTop: `1px solid ${C.line}`, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  <td style={{ textAlign: "left", padding: 6 }}>{a.anno}</td><td style={{ padding: 6 }}>{num(a.crediti)}</td><td style={{ padding: 6 }}>{euro(a.ricavi)}</td><td style={{ padding: 6 }}>{euro(a.costi)}</td><td style={{ padding: 6 }}>{euro(a.margine)}</td><td style={{ padding: 6 }}>{euro(a.cumulato)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 12.5, color: C.grafite, marginTop: 14, lineHeight: 1.5 }}>
        <b>Ipotesi della stima</b>
        <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{r.ipotesi.map((i) => <li key={i}>{i}</li>)}</ul>
      </div>
      <a href="#registrazione" style={{ ...bottone, display: "inline-block", marginTop: 14, textDecoration: "none" }}>Chiedi la registrazione del Comune ↓</a>
    </section>
  );
}

/* Grafico a barre (ricavi e costi per anno) con la linea del margine
   cumulato, in SVG che si adatta alla larghezza. */
function Grafico({ righe }) {
  // Sul telefono un disegno più stretto: testi leggibili e meno etichette.
  const stretto = typeof window !== "undefined" && window.innerWidth < 600;
  const W = stretto ? 380 : 760, H = stretto ? 260 : 300, sx = stretto ? 40 : 56, dx = 10, sy = 18, gy = 34;
  const max = Math.max(...righe.map((r) => Math.max(r.ricavi, r.costi)), 1);
  const maxCum = Math.max(...righe.map((r) => r.cumulato), 1);
  const minCum = Math.min(0, ...righe.map((r) => r.cumulato));
  const area = W - sx - dx, alt = H - sy - gy;
  const passo = area / righe.length;
  const lb = Math.max(2, Math.min(18, passo * 0.32));
  const y = (v) => sy + alt - (v / max) * alt;
  const yc = (v) => sy + alt - ((v - minCum) / (maxCum - minCum || 1)) * alt;
  const linea = righe.map((r, i) => `${i ? "L" : "M"}${(sx + passo * (i + 0.5)).toFixed(1)},${yc(r.cumulato).toFixed(1)}`).join(" ");
  const tacche = [0, 0.25, 0.5, 0.75, 1].map((q) => q * max);
  const ogni = Math.ceil(righe.length / (stretto ? 5 : 10));
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ricavi e costi per anno e margine cumulato" style={{ width: "100%", height: "auto", display: "block" }}>
        {tacche.map((v) => (
          <g key={v}>
            <line x1={sx} x2={W - dx} y1={y(v)} y2={y(v)} stroke={C.line} strokeWidth="1" />
            <text x={sx - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill={C.grafite}>{v >= 1000 ? `${Math.round(v / 1000).toLocaleString("it-IT")}k` : Math.round(v)}</text>
          </g>
        ))}
        {righe.map((r, i) => {
          const cx = sx + passo * (i + 0.5);
          return (
            <g key={r.anno}>
              <rect x={cx - lb - 1} y={y(r.ricavi)} width={lb} height={alt + sy - y(r.ricavi)} fill={C.green} rx="2"><title>{`${r.anno}: ricavi ${euro(r.ricavi)}`}</title></rect>
              <rect x={cx + 1} y={y(r.costi)} width={lb} height={alt + sy - y(r.costi)} fill="#c98a1a" rx="2"><title>{`${r.anno}: costi ${euro(r.costi)}`}</title></rect>
              {i % ogni === 0 && <text x={cx} y={H - gy + 16} textAnchor="middle" fontSize="11" fill={C.grafite}>{r.anno}</text>}
            </g>
          );
        })}
        <path d={linea} fill="none" stroke={C.ink} strokeWidth="2.2" strokeDasharray="5 4" />
      </svg>
      <figcaption style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: C.grafite, marginTop: 4 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: C.green, borderRadius: 2, marginRight: 5 }} />Ricavi</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#c98a1a", borderRadius: 2, marginRight: 5 }} />Costi</span>
        <span><span style={{ display: "inline-block", width: 16, borderTop: `2px dashed ${C.ink}`, marginRight: 5, verticalAlign: "middle" }} />Margine cumulato (scala propria, fino a {euro(maxCum)})</span>
      </figcaption>
    </figure>
  );
}

function Riquadro({ etichetta, valore, grande }) {
  return (
    <div style={{ background: grande ? C.green : C.paper, color: grande ? C.white : C.ink, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontFamily: "'Archivo'", fontSize: grande ? 26 : 21, fontWeight: 800 }}>{valore}</div>
      <div style={{ fontSize: 12.5, color: grande ? "#e4ede1" : C.grafite }}>{etichetta}</div>
    </div>
  );
}

function Campo({ etichetta: e, valore, onChange, testo = false, tipo = "text" }) {
  return (
    <label style={{ ...etichetta, display: "grid", gap: 4 }}>
      {e}
      <input type={tipo} inputMode={testo ? undefined : "decimal"} value={valore} onChange={(ev) => onChange(ev.target.value)} style={campoStile} />
    </label>
  );
}

const sezione = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 20px", marginBottom: 22, position: "relative" };
const h2 = { fontFamily: "'Archivo'", fontSize: 20, margin: "0 0 8px" };
const etichetta = { fontSize: 12.5, color: C.grafite, fontWeight: 600, marginBottom: 6 };
const campoStile = { padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 16, fontFamily: "inherit", background: C.white, color: C.ink, width: "100%", boxSizing: "border-box" };
const bottone = { background: C.green, color: C.white, border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const bottoneSecondario = { background: C.white, color: C.green, border: `1px solid ${C.green}`, borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
