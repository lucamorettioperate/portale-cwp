/* =========================================================================
   ElencoEnti — elenco dei Comuni o dei gestori nella sezione Marketing
   (richiesta di Luca Moretti del 23/10/2026, script 44).
   Filtri per regione, provincia, testo, popolazione (Comuni), natura e
   attività (gestori), solo enti con email generica; pagine da 50 righe;
   un clic sul nome apre la scheda con tutti i recapiti e i referenti,
   modificabili (PEC, email generica, sito, telefono, note; per i gestori
   natura e attività verificate; referenti nuovi, modificati, tolti).
   Props: tipo ("comune" | "gestore"), regioni (elenco dei nomi).
   Dati: elencaEnti, leggiEnte, salvaEnte, salvaReferente, eliminaReferente,
     provinceDi (src/lib/marketingDati.js). Solo Amministratori (RLS).
   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import { elencaEnti, leggiEnte, salvaEnte, salvaReferente, eliminaReferente, provinceDi } from "../../lib/marketingDati.js";
import { campo, btnPrimario, btnMini } from "../stili.js";

export const RUOLI_REFERENTE = {
  sindaco: "Sindaco", tributi: "Responsabile tributi", ambiente: "Responsabile ambiente", finanziario: "Responsabile finanziario",
  tecnico: "Responsabile tecnico", direttore_generale: "Direttore generale", direttore_tecnico: "Direttore tecnico",
  amministratore: "Amministratore", altro: "Altro",
};
const num = (n) => (n == null ? "—" : Number(n).toLocaleString("it-IT"));

export default function ElencoEnti({ tipo, regioni }) {
  const comune = tipo === "comune";
  const [filtri, setFiltri] = useState({ tipo, regioni: [], province: [], cerca: "", popMin: "", popMax: "", conEmail: false, natura: "", raccolta: false, tariffa: false });
  const [province, setProvince] = useState([]);
  const [pagina, setPagina] = useState(0);
  const [elenco, setElenco] = useState({ data: [], totale: 0, perPagina: 50 });
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState("");
  const [aperto, setAperto] = useState(null); // id dell'ente aperto

  // Ricarica a ogni cambio di filtri o pagina (con un piccolo ritardo per il testo).
  useEffect(() => {
    const t = setTimeout(async () => {
      setCaricamento(true);
      const r = await elencaEnti(filtri, pagina);
      setCaricamento(false);
      setErrore(r.error ? r.error.message : "");
      setElenco(r);
    }, 250);
    return () => clearTimeout(t);
  }, [filtri, pagina]);

  // Province delle regioni scelte.
  useEffect(() => {
    if (!filtri.regioni.length) { setProvince([]); return; }
    provinceDi(filtri.regioni).then(({ data }) => setProvince(data || []));
  }, [filtri.regioni]);

  const cambia = (campi) => { setFiltri((f) => ({ ...f, ...campi })); setPagina(0); };
  const pagine = Math.max(1, Math.ceil(elenco.totale / elenco.perPagina));

  return (
    <div>
      {/* Filtri */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input value={filtri.cerca} onChange={(e) => cambia({ cerca: e.target.value })} placeholder={comune ? "Cerca un Comune…" : "Cerca ragione sociale, comune o codice fiscale…"} aria-label="Cerca" style={{ ...campo, flex: "1 1 220px" }} />
        <select value={filtri.regioni[0] || ""} onChange={(e) => cambia({ regioni: e.target.value ? [e.target.value] : [], province: [] })} style={campo} aria-label="Regione">
          <option value="">Tutte le regioni</option>
          {regioni.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {province.length > 0 && (
          <select value={filtri.province[0] || ""} onChange={(e) => cambia({ province: e.target.value ? [e.target.value] : [] })} style={campo} aria-label="Provincia">
            <option value="">Tutte le province</option>
            {province.map((p) => <option key={p.sigla} value={p.sigla}>{p.nome}</option>)}
          </select>
        )}
        {comune && (
          <>
            <input value={filtri.popMin} onChange={(e) => cambia({ popMin: e.target.value })} inputMode="numeric" placeholder="Abitanti da" aria-label="Abitanti da" style={{ ...campo, width: 110 }} />
            <input value={filtri.popMax} onChange={(e) => cambia({ popMax: e.target.value })} inputMode="numeric" placeholder="a" aria-label="Abitanti fino a" style={{ ...campo, width: 90 }} />
          </>
        )}
        {!comune && (
          <select value={filtri.natura} onChange={(e) => cambia({ natura: e.target.value })} style={campo} aria-label="Natura">
            <option value="">Pubblici e privati</option>
            <option value="pubblico">Pubblici</option>
            <option value="privato">Privati</option>
            <option value="misto">Misti</option>
          </select>
        )}
        <label style={{ fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={filtri.conEmail} onChange={(e) => cambia({ conEmail: e.target.checked })} /> con email generica</label>
        {!comune && <label style={{ fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={filtri.raccolta} onChange={(e) => cambia({ raccolta: e.target.checked })} /> raccolta per Comuni</label>}
        {!comune && <label style={{ fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={filtri.tariffa} onChange={(e) => cambia({ tariffa: e.target.checked })} /> gestione tariffa</label>}
      </div>
      <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 8 }}>
        {caricamento ? "Caricamento…" : `${num(elenco.totale)} ${comune ? "Comuni" : "gestori"}`}
        {errore && <span style={{ color: C.red }}> · {errore}</span>}
      </div>

      <div style={{ overflowX: "auto", background: C.white, border: `1px solid ${C.line}`, borderRadius: 12 }}>
        <table className="tabella-schede" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
          <thead>
            <tr style={{ background: C.paperWarm, textAlign: "left" }}>
              <th style={th}>{comune ? "Comune" : "Impresa"}</th>
              <th style={th}>Prov.</th>
              <th style={{ ...th, textAlign: "right" }}>{comune ? "Abitanti" : "Categorie Albo"}</th>
              <th style={th}>Email generica</th>
              <th style={th}>PEC</th>
              <th style={{ ...th, textAlign: "right" }}>Referenti</th>
            </tr>
          </thead>
          <tbody>
            {elenco.data.map((e) => (
              <tr key={e.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={td} data-etichetta={comune ? "Comune" : "Impresa"}>
                  <button onClick={() => setAperto(e.id)} style={{ background: "none", border: "none", padding: 0, color: C.green, fontWeight: 700, cursor: "pointer", textAlign: "left", textDecoration: "underline", font: "inherit" }}>{e.denominazione}</button>
                  {!comune && (e.natura || e.attivita_raccolta || e.attivita_tariffa) && (
                    <div style={{ fontSize: 11.5, color: C.grafite }}>{[e.natura, e.attivita_raccolta && "raccolta per Comuni", e.attivita_tariffa && "gestione tariffa"].filter(Boolean).join(" · ")}</div>
                  )}
                </td>
                <td style={td} data-etichetta="Provincia">{e.sigla || "—"}{e.comune_sede && !comune ? ` · ${e.comune_sede}` : ""}</td>
                <td style={{ ...td, textAlign: comune ? "right" : "left" }} data-etichetta={comune ? "Abitanti" : "Categorie Albo"}>{comune ? num(e.popolazione) : e.albo_categorie || "—"}</td>
                <td style={td} data-etichetta="Email generica">{e.email || <span style={{ color: C.grafite }}>—</span>}</td>
                <td style={{ ...td, wordBreak: "break-all" }} data-etichetta="PEC">{e.pec || <span style={{ color: C.grafite }}>—</span>}</td>
                <td style={{ ...td, textAlign: "right" }} data-etichetta="Referenti">{e.referenti?.[0]?.count ?? 0}</td>
              </tr>
            ))}
            {!caricamento && !elenco.data.length && (
              <tr><td colSpan={6} style={{ ...td, color: C.grafite }}>Nessun ente con questi filtri. Se l'elenco è vuoto, importa i dati dalla scheda «Importazioni».</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pagine > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12.5 }}>
          <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0} style={btnMini}>← Precedenti</button>
          <span>Pagina {pagina + 1} di {num(pagine)}</span>
          <button onClick={() => setPagina((p) => Math.min(pagine - 1, p + 1))} disabled={pagina >= pagine - 1} style={btnMini}>Successivi →</button>
        </div>
      )}
      {aperto && <SchedaEnte id={aperto} onChiudi={(cambiato) => { setAperto(null); if (cambiato) setFiltri((f) => ({ ...f })); }} />}
    </div>
  );
}

/* Scheda di un ente: recapiti modificabili e referenti. Props: id,
   onChiudi(cambiato). */
function SchedaEnte({ id, onChiudi }) {
  const [ente, setEnte] = useState(null);
  const [modulo, setModulo] = useState(null);
  const [esito, setEsito] = useState(null);
  const [cambiato, setCambiato] = useState(false);
  const [nuovo, setNuovo] = useState(null);

  async function carica() {
    const { data, error } = await leggiEnte(id);
    if (error) { setEsito({ errore: true, testo: error.message }); return; }
    setEnte(data);
    setModulo({ pec: data.pec || "", email: data.email || "", sito: data.sito || "", telefono: data.telefono || "", note: data.note || "", natura: data.natura || "", attivita_raccolta: !!data.attivita_raccolta, attivita_tariffa: !!data.attivita_tariffa });
  }
  useEffect(() => { carica(); }, [id]);

  async function salva() {
    const campi = { pec: modulo.pec.trim() || null, email: modulo.email.trim().toLowerCase() || null, sito: modulo.sito.trim() || null, telefono: modulo.telefono.trim() || null, note: modulo.note.trim() || null };
    if (ente.tipo === "gestore") Object.assign(campi, { natura: modulo.natura || null, attivita_raccolta: modulo.attivita_raccolta, attivita_tariffa: modulo.attivita_tariffa, verificato_il: new Date().toISOString().slice(0, 10) });
    const { error } = await salvaEnte(id, campi);
    if (error) setEsito({ errore: true, testo: /mkt_email_non_pec/.test(error.message) ? "L'email generica non può essere una PEC: mettila nel campo PEC." : error.message });
    else { setEsito({ testo: "Dati salvati." }); setCambiato(true); carica(); }
  }
  async function salvaRef(r) {
    const { error } = await salvaReferente(r);
    if (error) setEsito({ errore: true, testo: error.message });
    else { setNuovo(null); setCambiato(true); carica(); }
  }
  async function togliRef(rid) {
    if (!window.confirm("Togliere questo referente?")) return;
    const { error } = await eliminaReferente(rid);
    if (error) setEsito({ errore: true, testo: error.message }); else { setCambiato(true); carica(); }
  }

  return (
    <div className="modulo-utenza-sfondo" role="dialog" aria-modal="true" aria-label="Scheda dell'ente" style={{ position: "fixed", inset: 0, background: "rgba(27,33,24,.45)", zIndex: 50, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "30px 12px", overflowY: "auto" }}>
      <div className="modulo-utenza" style={{ background: C.white, borderRadius: 14, padding: 22, width: "min(760px, 100%)", boxSizing: "border-box" }}>
        {!ente ? <div>{esito?.testo || "Caricamento…"}</div> : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontFamily: "'Archivo'", fontSize: 18, margin: "0 0 4px" }}>{ente.denominazione}</h2>
                <div style={{ fontSize: 12.5, color: C.grafite }}>
                  {[ente.regione, ente.provincia && `${ente.provincia} (${ente.sigla})`, ente.comune_sede && ente.tipo === "gestore" && `sede a ${ente.comune_sede}`, ente.popolazione && `${num(ente.popolazione)} abitanti`, ente.codice_fiscale && `C.F. ${ente.codice_fiscale}`, ente.albo_numero && `Albo ${ente.albo_numero}`, ente.albo_categorie && `categorie ${ente.albo_categorie}`].filter(Boolean).join(" · ")}
                </div>
                {ente.indirizzo && <div style={{ fontSize: 12.5, color: C.grafite }}>{ente.indirizzo}{ente.cap ? `, ${ente.cap}` : ""}</div>}
                <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 2 }}>Fonti: {(ente.fonti || []).join(", ") || "—"}{ente.verificato_il ? ` · verificato il ${new Date(ente.verificato_il).toLocaleDateString("it-IT")}` : ""}</div>
              </div>
              <button onClick={() => onChiudi(cambiato)} style={btnMini} aria-label="Chiudi">✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "4px 12px", marginTop: 14 }}>
              <Campo etichetta="Email generica (riceve le campagne)" valore={modulo.email} onChange={(v) => setModulo({ ...modulo, email: v })} />
              <Campo etichetta="PEC (mai usata per le campagne)" valore={modulo.pec} onChange={(v) => setModulo({ ...modulo, pec: v })} />
              <Campo etichetta="Sito" valore={modulo.sito} onChange={(v) => setModulo({ ...modulo, sito: v })} />
              <Campo etichetta="Telefono" valore={modulo.telefono} onChange={(v) => setModulo({ ...modulo, telefono: v })} />
            </div>
            {ente.tipo === "gestore" && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 13, margin: "4px 0 8px" }}>
                <select value={modulo.natura} onChange={(e) => setModulo({ ...modulo, natura: e.target.value })} style={campo} aria-label="Natura">
                  <option value="">Natura da verificare</option><option value="pubblico">Pubblico</option><option value="privato">Privato</option><option value="misto">Misto</option>
                </select>
                <label><input type="checkbox" checked={modulo.attivita_raccolta} onChange={(e) => setModulo({ ...modulo, attivita_raccolta: e.target.checked })} /> fa raccolta per i Comuni</label>
                <label><input type="checkbox" checked={modulo.attivita_tariffa} onChange={(e) => setModulo({ ...modulo, attivita_tariffa: e.target.checked })} /> gestisce la tariffa</label>
              </div>
            )}
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600 }}>Note
              <textarea rows={2} value={modulo.note} onChange={(e) => setModulo({ ...modulo, note: e.target.value })} style={{ ...campo, resize: "vertical" }} />
            </label>
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={salva} style={btnPrimario}>Salva</button>
              {ente.sito && <a href={ente.sito} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: C.green }}>Apri il sito ↗</a>}
              {esito && <span style={{ fontSize: 12.5, color: esito.errore ? C.red : C.green }}>{esito.testo}</span>}
            </div>

            <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: "18px 0 6px" }}>Referenti</h3>
            {(ente.referenti || []).length === 0 && <div style={{ fontSize: 12.5, color: C.grafite }}>Nessun referente.</div>}
            {(ente.referenti || []).sort((a, b) => a.ruolo.localeCompare(b.ruolo)).map((r) => (
              <RigaReferente key={r.id} r={r} onSalva={salvaRef} onTogli={() => togliRef(r.id)} />
            ))}
            {nuovo ? (
              <ModuloReferente r={nuovo} onSalva={salvaRef} onAnnulla={() => setNuovo(null)} />
            ) : (
              <button onClick={() => setNuovo({ ente_id: id, ruolo: ente.tipo === "comune" ? "tributi" : "direttore_generale", nome: "", cognome: "", ufficio: "", email: "", telefono: "", fonte: "" })} style={{ ...btnMini, marginTop: 8 }}>+ Referente</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Campo({ etichetta, valore, onChange }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 8 }}>
      {etichetta}
      <input value={valore} onChange={(e) => onChange(e.target.value)} style={campo} />
    </label>
  );
}

function RigaReferente({ r, onSalva, onTogli }) {
  const [modifica, setModifica] = useState(false);
  if (modifica) return <ModuloReferente r={r} onSalva={(x) => { onSalva(x); setModifica(false); }} onAnnulla={() => setModifica(false)} />;
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "7px 0", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <div>
        <b>{RUOLI_REFERENTE[r.ruolo] || r.ruolo}</b>: {[r.nome, r.cognome].filter(Boolean).join(" ") || "—"}
        {r.ufficio && <span style={{ color: C.grafite }}> · {r.ufficio}</span>}
        <div style={{ fontSize: 12, color: C.grafite }}>{[r.email, r.telefono, r.fonte && `fonte: ${r.fonte}`].filter(Boolean).join(" · ")}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setModifica(true)} style={btnMini}>Modifica</button>
        <button onClick={onTogli} style={{ ...btnMini, color: C.red }}>Togli</button>
      </div>
    </div>
  );
}

function ModuloReferente({ r, onSalva, onAnnulla }) {
  const [m, setM] = useState({ ...r });
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, margin: "8px 0", background: C.paper }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "4px 10px" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600 }}>Ruolo
          <select value={m.ruolo} onChange={(e) => setM({ ...m, ruolo: e.target.value })} style={campo}>
            {Object.entries(RUOLI_REFERENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <Campo etichetta="Nome" valore={m.nome || ""} onChange={(v) => setM({ ...m, nome: v })} />
        <Campo etichetta="Cognome" valore={m.cognome || ""} onChange={(v) => setM({ ...m, cognome: v })} />
        <Campo etichetta="Ufficio" valore={m.ufficio || ""} onChange={(v) => setM({ ...m, ufficio: v })} />
        <Campo etichetta="Email" valore={m.email || ""} onChange={(v) => setM({ ...m, email: v })} />
        <Campo etichetta="Telefono" valore={m.telefono || ""} onChange={(v) => setM({ ...m, telefono: v })} />
        <Campo etichetta="Fonte (es. sito del Comune)" valore={m.fonte || ""} onChange={(v) => setM({ ...m, fonte: v })} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={() => onSalva({ id: m.id, ente_id: m.ente_id, ruolo: m.ruolo, nome: m.nome?.trim() || null, cognome: m.cognome?.trim() || null, ufficio: m.ufficio?.trim() || null, email: m.email?.trim().toLowerCase() || null, telefono: m.telefono?.trim() || null, fonte: m.fonte?.trim() || null })} style={btnPrimario}>Salva referente</button>
        <button onClick={onAnnulla} style={btnMini}>Annulla</button>
      </div>
    </div>
  );
}

const th = { padding: "9px 10px", fontSize: 11.5, color: C.grafite, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 700 };
const td = { padding: "8px 10px", verticalAlign: "top" };
