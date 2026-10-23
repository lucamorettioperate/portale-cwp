/* =========================================================================
   Importazioni — aggiornamento delle banche dati della sezione Marketing
   (richiesta di Luca Moretti del 23/10/2026, funzione «marketing»).
   - Comuni: elenco ISTAT (regione, provincia, abitanti), poi IndicePA
     (PEC, email generica, sito, sindaco) e le unità organizzative
     (responsabili di tributi, ambiente, finanziario, tecnico), a blocchi.
   - Gestori: imprese iscritte all'Albo Nazionale Gestori Ambientali in
     categoria 1 ordinaria, una sezione regionale alla volta; PEC, email e
     sito dei gestori pubblici da IndicePA. La verifica sui siti delle
     attività (raccolta, tariffa) e dei referenti si completa nella scheda
     di ogni gestore e con gli arricchimenti caricati dallo sviluppo.
   Le importazioni aggiornano i dati senza cancellare quelli inseriti a
   mano (email e referenti modificati restano, salvo nuovi valori della
   stessa fonte).
   Props: riepilogo [{ tipo, regione, enti, con_email, con_pec,
   con_referenti }], onFatto() per ricaricarlo.
   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import React, { useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import { azioneMarketing } from "../../lib/marketingDati.js";
import { btnPrimario, btnMini } from "../stili.js";

// Sezioni regionali dell'Albo (id usati dall'elenco pubblico degli iscritti).
const SEZIONI = [["13", "Abruzzo"], ["17", "Basilicata"], ["21", "Bolzano"], ["18", "Calabria"], ["15", "Campania"], ["8", "Emilia-Romagna"], ["6", "Friuli-Venezia Giulia"], ["12", "Lazio"], ["7", "Liguria"], ["3", "Lombardia"], ["11", "Marche"], ["14", "Molise"], ["1", "Piemonte"], ["16", "Puglia"], ["20", "Sardegna"], ["19", "Sicilia"], ["9", "Toscana"], ["4", "Trento"], ["10", "Umbria"], ["2", "Valle d'Aosta"], ["5", "Veneto"]];
const num = (n) => Number(n || 0).toLocaleString("it-IT");

export default function Importazioni({ riepilogo, onFatto }) {
  const [diario, setDiario] = useState([]);
  const [inCorso, setInCorso] = useState(false);
  const scrivi = (riga) => setDiario((d) => [...d, riga]);

  async function comuni() {
    setInCorso(true);
    setDiario([]);
    scrivi("Elenco ISTAT dei Comuni…");
    let r = await azioneMarketing("importa_comuni", { fase: "base" });
    if (r.error) return fine(`Errore: ${r.error.message}`);
    scrivi(`✓ ${num(r.data.fatti)} Comuni dall'elenco ISTAT.`);
    scrivi("IndicePA: PEC, email, sito e sindaco…");
    r = await azioneMarketing("importa_comuni", { fase: "ipa" });
    if (r.error) return fine(`Errore IndicePA: ${r.error.message}`);
    scrivi(`✓ ${num(r.data.fatti)} Comuni aggiornati da IndicePA.`);
    let da = 0;
    for (;;) {
      scrivi(`IndicePA: uffici dei Comuni, dal n. ${num(da + 1)}…`);
      r = await azioneMarketing("importa_comuni", { fase: "uo", da });
      if (r.error) return fine(`Errore uffici: ${r.error.message}. IndicePA a volte non risponde: ripetete «Aggiorna i Comuni» più tardi (i dati già letti restano).`);
      scrivi(`✓ ${num(r.data.fatti)} uffici letti, ${num(r.data.referenti)} referenti.`);
      if (r.data.prossimo == null) break;
      da = r.data.prossimo;
    }
    fine("Comuni aggiornati.");
  }

  async function gestori(sezioni = SEZIONI) {
    setInCorso(true);
    setDiario([]);
    let totale = 0;
    // Una provincia per chiamata (la funzione risponde con «prossimo»).
    for (const [id, nome] of sezioni) {
      let indice = 0;
      let lette = 0, cat1 = 0, ipa = 0, ipaAssente = false;
      for (;;) {
        const r = await azioneMarketing("importa_albo", { sezione: id, indice });
        if (r.error) { scrivi(`✗ ${nome}, provincia ${indice + 1}: ${r.error.message}`); }
        else {
          lette += r.data.lette; cat1 += r.data.categoria_1o; ipa += r.data.con_dati_ipa || 0;
          ipaAssente = ipaAssente || !!r.data.ipa_non_disponibile;
        }
        if (r.error || r.data.prossimo == null) break;
        indice = r.data.prossimo;
      }
      totale += cat1;
      scrivi(`✓ ${nome}: ${num(lette)} iscritti letti, ${num(cat1)} in categoria 1 ordinaria${ipa ? `, ${num(ipa)} con dati da IndicePA` : ""}${ipaAssente ? " (IndicePA non disponibile: ripetere più tardi per PEC ed email dei gestori pubblici)" : ""}.`);
    }
    fine(`Gestori aggiornati: ${num(totale)} imprese in categoria 1 ordinaria.`);
  }

  function fine(riga) {
    scrivi(riga);
    setInCorso(false);
    onFatto && onFatto();
  }

  const righe = (tipo) => riepilogo.filter((r) => r.tipo === tipo);
  const totale = (tipo, k) => righe(tipo).reduce((s, r) => s + Number(r[k] || 0), 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
      <section style={sezione}>
        <h3 style={h3}>Banche dati</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
            <thead><tr style={{ textAlign: "left", color: C.grafite, fontSize: 11.5 }}><th style={th}>Banca dati</th><th style={thN}>Enti</th><th style={thN}>Con email generica</th><th style={thN}>Con PEC</th><th style={thN}>Con referenti</th></tr></thead>
            <tbody>
              {[["comune", "Comuni"], ["gestore", "Gestori (Albo cat. 1 ordinaria)"]].map(([k, n]) => (
                <tr key={k} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={td}>{n}</td><td style={tdN}>{num(totale(k, "enti"))}</td><td style={tdN}>{num(totale(k, "con_email"))}</td><td style={tdN}>{num(totale(k, "con_pec"))}</td><td style={tdN}>{num(totale(k, "con_referenti"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={sezione}>
        <h3 style={h3}>Aggiorna</h3>
        <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 10px", lineHeight: 1.5 }}>
          <b>Comuni</b>: elenco ISTAT con regione, provincia e abitanti; da IndicePA (Indice dei domicili digitali della PA, open data) PEC, email generica, sito, sindaco e responsabili degli uffici tributi, ambiente, finanziario e tecnico. Qualche minuto.<br />
          <b>Gestori</b>: imprese iscritte all'Albo Nazionale Gestori Ambientali in categoria 1 ordinaria (raccolta e trasporto di rifiuti urbani), sezione per sezione; per i gestori pubblici anche PEC, email e sito da IndicePA. Le attività (raccolta, tariffa) e i referenti delle imprese si verificano sui loro siti.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={comuni} disabled={inCorso} style={btnPrimario}>Aggiorna i Comuni</button>
          <button onClick={() => gestori()} disabled={inCorso} style={btnPrimario}>Aggiorna i gestori (tutte le regioni)</button>
          <select disabled={inCorso} onChange={(e) => { const s = SEZIONI.find(([id]) => id === e.target.value); if (s) gestori([s]); e.target.value = ""; }} style={{ ...btnMini, padding: "8px 10px" }} aria-label="Aggiorna una sola sezione dell'Albo" defaultValue="">
            <option value="">Solo una sezione dell'Albo…</option>
            {SEZIONI.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </div>
        {diario.length > 0 && (
          <div role="log" style={{ marginTop: 12, background: C.paper, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, maxHeight: 280, overflowY: "auto", lineHeight: 1.6 }}>
            {diario.map((r, i) => <div key={i} style={{ color: /^✗|Errore/.test(r) ? C.red : C.ink }}>{r}</div>)}
            {inCorso && <div style={{ color: C.grafite }}>…</div>}
          </div>
        )}
      </section>
    </div>
  );
}

const sezione = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 };
const h3 = { fontFamily: "'Archivo'", fontSize: 15, margin: "0 0 10px" };
const th = { padding: "6px 8px", textTransform: "uppercase", letterSpacing: 0.3 };
const thN = { ...th, textAlign: "right" };
const td = { padding: "7px 8px" };
const tdN = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
