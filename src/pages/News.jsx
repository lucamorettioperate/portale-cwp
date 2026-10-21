/* =========================================================================
   Notizie CO2 — indirizzo «/notizie-co2» (prima «News», «/news»: il
   vecchio indirizzo porta qui)
   Scopo (richiesta di Luca Moretti del 21/10/2026): osservatorio riservato
     agli Amministratori sulle notizie dal mondo dei crediti di carbonio
     volontari: mercato volontario, marketplace e borse, prezzi dei crediti
     scambiati o venduti, standard e registri, regole, progetti (in
     particolare rifiuti ed economia circolare).
     Le notizie le cerca ogni 2 ore la funzione del server «notizie»
     (lavoro pianificato dello script 36) e le controlla Claude: qui si
     vedono solo quelle attinenti, con titolo e sintesi in italiano,
     categoria, rilevanza (1-5) e i prezzi citati. Le scartate si possono
     vedere per controllare il filtro, con il motivo.
   Cosa si fa: cercare e filtrare (testo, categoria, periodo, rilevanza),
     aprire l'articolo originale, nascondere una notizia, «Aggiorna ora»
     (al massimo una ricerca ogni 10 minuti). In alto il riquadro «Prezzi
     citati» raccoglie i valori unitari trovati negli ultimi 30 giorni.
   Chi la vede: solo gli Amministratori (menu e controllo qui); il
     controllo vero è nel database (RLS con app_is_admin, script 36).
   Dati: elencaNotizie, ultimeRicercheNotizie, nascondiNotizia,
     aggiornaNotizie (src/lib/dati.js); categorie da src/lib/notizie.js.
   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)»; script 36;
     capitolo 5 «Edge Functions» (notizie).
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import Header from "../components/Header.jsx";
import { useAuth } from "../lib/AuthContext.jsx";
import { aggiornaNotizie, elencaNotizie, nascondiNotizia, ultimeRicercheNotizie } from "../lib/dati.js";
import { CATEGORIE } from "../lib/notizie.js";

// Data breve in ora italiana: «oggi 14:07», «ieri», «18/10».
function quando(v) {
  if (!v) return "data non indicata";
  const d = new Date(v);
  const z = { timeZone: "Europe/Rome" };
  const giorno = (x) => x.toLocaleDateString("it-IT", z);
  const ora = d.toLocaleTimeString("it-IT", { ...z, hour: "2-digit", minute: "2-digit" });
  if (giorno(d) === giorno(new Date())) return `oggi ${ora}`;
  if (giorno(d) === giorno(new Date(Date.now() - 86400000))) return `ieri ${ora}`;
  return d.toLocaleDateString("it-IT", { ...z, day: "2-digit", month: "2-digit", year: "numeric" });
}

// Periodi del filtro (giorni; 0 = tutto).
const PERIODI = [
  [7, "Ultimi 7 giorni"],
  [30, "Ultimi 30 giorni"],
  [0, "Tutto"],
];

/* Pagina. Nessuna prop. */
export default function News() {
  const { ruolo } = useAuth();
  const [notizie, setNotizie] = useState([]);
  const [ricerche, setRicerche] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [inCorso, setInCorso] = useState(false);
  // Filtri.
  const [testo, setTesto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [periodo, setPeriodo] = useState(30);
  const [minRilevanza, setMinRilevanza] = useState(1);
  const [conScartate, setConScartate] = useState(false);
  const [conNascoste, setConNascoste] = useState(false);
  const [vediRicerche, setVediRicerche] = useState(false);

  async function carica() {
    const [n, r] = await Promise.all([elencaNotizie({ scartate: conScartate, nascoste: conNascoste }), ultimeRicercheNotizie()]);
    if (n.error || r.error) {
      const m = (n.error || r.error).message;
      setErrore(/notizia|notizie_esecuzione/.test(m) && /(does not exist|schema cache|not find)/i.test(m) ? "La sezione non è ancora attiva: va eseguito lo script 36 nel SQL Editor di Supabase." : m);
    } else {
      setErrore("");
      setNotizie(n.data || []);
      setRicerche(r.data || []);
    }
    setCaricamento(false);
  }
  // Subito e poi ogni 5 minuti (le ricerche pianificate arrivano da sole).
  useEffect(() => {
    if (ruolo !== "admin") return undefined;
    carica();
    const t = setInterval(carica, 5 * 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruolo, conScartate, conNascoste]);

  // Notizie dopo i filtri (il testo cerca in titoli, sintesi, fonte, prezzi).
  const filtrate = useMemo(() => {
    const limite = periodo ? Date.now() - periodo * 86400000 : 0;
    const t = testo.trim().toLowerCase();
    return notizie.filter((n) => {
      const data = Date.parse(n.pubblicata_il || n.trovata_il);
      if (limite && data < limite) return false;
      if (n.attinente && categoria && n.categoria !== categoria) return false;
      if (n.attinente && (n.rilevanza || 1) < minRilevanza) return false;
      if (t && ![n.titolo, n.titolo_it, n.sintesi, n.fonte, n.prezzi].some((x) => (x || "").toLowerCase().includes(t))) return false;
      return true;
    });
  }, [notizie, testo, categoria, periodo, minRilevanza]);

  // Conteggi per categoria (solo attinenti, nel periodo e con il testo).
  const conteggi = useMemo(() => {
    const c = {};
    notizie.forEach((n) => {
      if (!n.attinente) return;
      const limite = periodo ? Date.now() - periodo * 86400000 : 0;
      if (limite && Date.parse(n.pubblicata_il || n.trovata_il) < limite) return;
      c[n.categoria || "altro"] = (c[n.categoria || "altro"] || 0) + 1;
    });
    return c;
  }, [notizie, periodo]);

  // Prezzi citati negli ultimi 30 giorni (notizie attinenti, visibili).
  const prezzi = useMemo(
    () => notizie.filter((n) => n.attinente && !n.nascosta && n.prezzi && Date.parse(n.pubblicata_il || n.trovata_il) > Date.now() - 30 * 86400000).slice(0, 12),
    [notizie]
  );

  async function aggiorna() {
    setInCorso(true);
    setMessaggio("Ricerca in corso: di solito servono 20-60 secondi…");
    const { data, error } = await aggiornaNotizie();
    setInCorso(false);
    if (error) setMessaggio(`Ricerca non riuscita: ${error.message}`);
    else if (data?.saltata) setMessaggio(data.motivo);
    else if (data?.esito === "errore") setMessaggio(`Ricerca non riuscita: ${data.errore || "errore sconosciuto"}`);
    else setMessaggio(`Ricerca completata: ${data?.lette ?? 0} notizie lette, ${data?.nuove ?? 0} nuove, ${data?.attinenti ?? 0} attinenti.`);
    carica();
  }

  async function nascondi(n) {
    const { error } = await nascondiNotizia(n.id, !n.nascosta);
    if (error) setMessaggio(error.message);
    else carica();
  }

  if (ruolo !== "admin") {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: C.grafite }}>Questa sezione è riservata agli amministratori.</div>
      </div>
    );
  }

  const ultima = ricerche.find((r) => r.esito !== "in_corso") || null;
  const prossima = (() => {
    // Lavoro pianificato ogni 2 ore al minuto 7 (ora UTC del server).
    const d = new Date();
    d.setUTCMinutes(7, 0, 0);
    while (d.getTime() <= Date.now() || d.getUTCHours() % 2 !== 0) d.setUTCHours(d.getUTCHours() + 1);
    return d.toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
  })();

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 16px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Notizie CO2</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 14px", maxWidth: 820 }}>
          Osservatorio sui crediti di carbonio volontari: mercato, marketplace, prezzi, standard e registri, regole e progetti. Le notizie si
          cercano ogni 2 ore e Claude tiene solo quelle attinenti, con una sintesi in italiano. Riservato agli Amministratori.
        </p>

        {/* Stato delle ricerche e «Aggiorna ora» */}
        <div style={{ ...riquadro, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            {ultima ? (
              <>
                <strong>Ultima ricerca:</strong> {quando(ultima.conclusa_il || ultima.avviata_il)}
                {ultima.esito === "ok" ? ` · ${ultima.lette} lette, ${ultima.nuove} nuove, ${ultima.attinenti} attinenti` : <span style={{ color: C.red }}> · non riuscita</span>}
                <span style={{ color: C.grafite }}> · prossima automatica alle {prossima} circa</span>
              </>
            ) : (
              <span style={{ color: C.grafite }}>Nessuna ricerca ancora eseguita. Prossima automatica alle {prossima} circa.</span>
            )}
            {messaggio && <div style={{ color: /non riuscita/.test(messaggio) ? C.red : C.green, fontWeight: 600 }}>{messaggio}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnMini} onClick={() => setVediRicerche(!vediRicerche)}>{vediRicerche ? "Nascondi registro" : "Registro ricerche"}</button>
            <button style={{ ...btnPrimario, opacity: inCorso ? 0.6 : 1 }} disabled={inCorso} onClick={aggiorna}>{inCorso ? "Ricerca in corso…" : "Aggiorna ora"}</button>
          </div>
        </div>

        {vediRicerche && <RegistroRicerche ricerche={ricerche} />}

        {errore && <div style={{ background: "#fbeeea", color: C.red, borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>{errore}</div>}

        {/* Prezzi citati (valori unitari scambiati o venduti) */}
        {prezzi.length > 0 && (
          <section style={{ ...riquadro, marginBottom: 12, background: C.greenSoft, borderColor: "#cfdcca" }}>
            <h2 style={{ fontSize: 14, margin: "0 0 8px", color: C.green }}>Prezzi citati negli ultimi 30 giorni</h2>
            <div style={{ display: "grid", gap: 6 }}>
              {prezzi.map((n) => (
                <div key={n.id} style={{ display: "grid", gridTemplateColumns: "minmax(70px, auto) 1fr", gap: 10, fontSize: 12.5, alignItems: "baseline" }}>
                  <span style={{ color: C.grafite, whiteSpace: "nowrap" }}>{quando(n.pubblicata_il || n.trovata_il)}</span>
                  <span>
                    <strong>{n.prezzi}</strong>{" "}
                    <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: C.green }}>{n.titolo_it || n.titolo}</a>
                    <span style={{ color: C.grafite }}> · {n.fonte}</span>
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: C.grafite, margin: "8px 0 0" }}>Valori riportati dagli articoli, non verificati: controllare sempre la fonte.</p>
          </section>
        )}

        {/* Filtri */}
        <div style={{ ...riquadro, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <Chip attivo={!categoria} onClick={() => setCategoria("")}>Tutte ({Object.values(conteggi).reduce((a, b) => a + b, 0)})</Chip>
            {Object.entries(CATEGORIE).map(([k, l]) => (
              <Chip key={k} attivo={categoria === k} onClick={() => setCategoria(categoria === k ? "" : k)}>
                {l} ({conteggi[k] || 0})
              </Chip>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ ...lbl, flex: "1 1 220px" }}>
              Cerca
              <input style={campo} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="es. Verra, prezzo, rifiuti, CBL" />
            </label>
            <label style={lbl}>
              Periodo
              <select style={campo} value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
                {PERIODI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={lbl}>
              Rilevanza
              <select style={campo} value={minRilevanza} onChange={(e) => setMinRilevanza(Number(e.target.value))}>
                <option value={1}>Tutte</option>
                <option value={3}>Almeno 3 su 5</option>
                <option value={4}>Almeno 4 su 5</option>
              </select>
            </label>
            <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", paddingBottom: 9 }}>
              <input type="checkbox" checked={conScartate} onChange={(e) => setConScartate(e.target.checked)} /> Mostra le scartate dal filtro
            </label>
            <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", paddingBottom: 9 }}>
              <input type="checkbox" checked={conNascoste} onChange={(e) => setConNascoste(e.target.checked)} /> Mostra le nascoste
            </label>
          </div>
        </div>

        {/* Elenco */}
        {caricamento ? (
          <p style={{ color: C.grafite, fontSize: 13 }}>Caricamento…</p>
        ) : filtrate.length === 0 ? (
          <div style={{ ...riquadro, color: C.grafite, fontSize: 13 }}>
            Nessuna notizia con questi filtri.{!notizie.length && " Le prime arriveranno con la prossima ricerca automatica, oppure premete «Aggiorna ora»."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtrate.map((n) => <Notizia key={n.id} n={n} onNascondi={() => nascondi(n)} />)}
          </div>
        )}
      </main>
    </div>
  );
}

/* Una notizia. Props: n (riga di notizia), onNascondi. */
function Notizia({ n, onNascondi }) {
  const titolo = n.titolo_it || n.titolo;
  return (
    <article style={{ ...riquadro, opacity: n.nascosta ? 0.6 : 1, borderLeft: `4px solid ${n.attinente ? (n.rilevanza >= 4 ? C.green : "#9db897") : C.line}` }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: C.grafite, marginBottom: 4 }}>
        <span>{quando(n.pubblicata_il || n.trovata_il)}</span>
        <span>·</span>
        <span style={{ fontWeight: 600, color: C.ink }}>{n.fonte || "fonte non indicata"}</span>
        {n.attinente ? (
          <>
            <span style={{ background: C.greenSoft, color: C.green, borderRadius: 999, padding: "2px 9px", fontWeight: 700 }}>{CATEGORIE[n.categoria] || "Altro"}</span>
            <span title={`Rilevanza ${n.rilevanza} su 5 per il Programma CWP`} aria-label={`Rilevanza ${n.rilevanza} su 5`} style={{ letterSpacing: 1, color: C.green }}>
              {"●".repeat(n.rilevanza || 1)}
              <span style={{ color: C.line }}>{"●".repeat(5 - (n.rilevanza || 1))}</span>
            </span>
          </>
        ) : (
          <span style={{ background: C.paperWarm, borderRadius: 999, padding: "2px 9px", fontWeight: 700 }}>Scartata dal filtro</span>
        )}
        {n.nascosta && <span style={{ fontWeight: 700 }}>Nascosta</span>}
      </div>
      <h3 style={{ fontSize: 15, margin: "0 0 4px", lineHeight: 1.35 }}>
        <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, textDecoration: "none" }}>
          {titolo} <span aria-hidden="true" style={{ color: C.grafite, fontSize: 12 }}>↗</span>
        </a>
      </h3>
      {n.titolo_it && n.titolo_it !== n.titolo && <div style={{ fontSize: 12, color: C.grafite, marginBottom: 4 }}>{n.titolo}</div>}
      {n.sintesi && <p style={{ fontSize: 13.5, margin: "4px 0", lineHeight: 1.5 }}>{n.sintesi}</p>}
      {n.prezzi && (
        <div style={{ fontSize: 12.5, margin: "6px 0 0" }}>
          <strong style={{ color: C.green }}>Prezzi citati:</strong> {n.prezzi}
        </div>
      )}
      {!n.attinente && n.motivo && <div style={{ fontSize: 12, color: C.grafite, marginTop: 4 }}>Motivo: {n.motivo}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <button style={{ ...btnMini, padding: "5px 10px", fontSize: 12 }} onClick={onNascondi}>{n.nascosta ? "Mostra di nuovo" : "Nascondi"}</button>
      </div>
    </article>
  );
}

/* Registro delle ultime ricerche. Props: ricerche (notizie_esecuzione). */
function RegistroRicerche({ ricerche }) {
  return (
    <div style={{ ...riquadro, marginBottom: 12, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
        <thead>
          <tr style={{ color: C.grafite, textAlign: "left" }}>
            {["Avviata", "Origine", "Esito", "Lette", "Nuove", "Attinenti", "Nota"].map((h) => <th key={h} style={{ padding: "6px 8px" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {ricerche.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${C.line}` }}>
              <td style={td}>{new Date(r.avviata_il).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
              <td style={td}>{r.origine === "manuale" ? "Aggiorna ora" : "Automatica"}</td>
              <td style={{ ...td, color: r.esito === "errore" ? C.red : r.esito === "ok" ? C.green : C.grafite, fontWeight: 700 }}>{r.esito === "in_corso" ? "in corso" : r.esito}</td>
              <td style={td}>{r.lette}</td>
              <td style={td}>{r.nuove}</td>
              <td style={td}>{r.attinenti}</td>
              <td style={{ ...td, color: C.grafite }}>{r.errore || ""}</td>
            </tr>
          ))}
          {!ricerche.length && (
            <tr><td style={td} colSpan={7}>Nessuna ricerca registrata.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* Pulsante a pillola dei filtri di categoria. */
function Chip({ attivo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={attivo}
      style={{
        padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
        border: `1px solid ${attivo ? C.green : C.line}`, background: attivo ? C.green : C.white, color: attivo ? C.white : C.ink,
      }}
    >
      {children}
    </button>
  );
}

// Stili della pagina (come le altre pagine dello staff).
const riquadro = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px" };
const lbl = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600 };
const campo = { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", background: C.white };
const btnPrimario = { background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnMini = { background: C.white, color: C.grafite, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const td = { padding: "6px 8px", verticalAlign: "top" };
