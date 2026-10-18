/* =========================================================================
   RegistroCrediti
   Scopo: registro dei crediti (backlog 7), vista «Registro» della pagina
     Calcolo crediti. Elenca i calcoli ex post confermati con il numero di
     registro assegnato dal database alla conferma (CWP-REG-AAAA-NNNN). Un
     calcolo corretto con una nuova versione confermata resta nel registro
     come «Sostituito»: valgono solo i crediti delle righe «Valido».
     Mostra i totali per ente e anno di riferimento, filtra le sole righe
     valide, esporta il registro in CSV e apre il calcolo con un clic.
     Le stime ex ante non entrano nel registro.
   Usato da: pagina Crediti (/crediti), vista «registro».
   Chi lo vede: admin.
   Dati: funzione del database admin_registro_crediti (script 18), chiamata
     direttamente con il client supabase (non passa da src/lib/dati.js);
     legge calcolo_crediti, pratica, organizzazione, profilo. Export CSV
     con scriviCsv / scaricaTesto (src/lib/csv.js).
   Sicurezza (garantita dal database, script 18): la funzione rifiuta chi
     non è Amministratore; il numero di registro lo assegna solo il database
     alla conferma (vietato in inserimento e sulle bozze) e non si riusa;
     i calcoli confermati sono immutabili. Questo componente legge soltanto.
   Registro sviluppo e deploy: capitolo «Calcolo crediti» (vedi anche
     docs/crediti-cwp.md)
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORI as C } from "../../lib/cwpProgram.js";
import Badge from "../Badge.jsx";
import { supabase } from "../../lib/supabase.js";
import { scriviCsv, scaricaTesto } from "../../lib/csv.js";
import { formatoData, oggiItalia } from "../../lib/date.js";

// Numero in formato italiano con d decimali (crediti in tCO2eq: 3 decimali).
const fmt = (v, d = 3) => (v == null ? "—" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }));

/* Registro dei crediti. Nessuna prop.
   Ogni riga: numero_registro, calcolo_id, pratica_codice, ente, anno,
   crediti_lordi, buffer_pct, crediti_netti, confermato_il, confermato_da
   (nome o email), sostituito_da (numero della versione che lo sostituisce),
   valido (true se non sostituito). */
export default function RegistroCrediti() {
  const navigate = useNavigate();
  // null = in caricamento; [] = registro vuoto.
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState("");
  const [soloValidi, setSoloValidi] = useState(false);

  // Legge il registro una volta, all'apertura della vista.
  useEffect(() => {
    supabase.rpc("admin_registro_crediti").then(({ data, error }) => {
      if (error) setErrore(error.message);
      setRighe(data || []);
    });
  }, []);

  const visibili = (righe || []).filter((r) => !soloValidi || r.valido);
  // Totali per coppia ente + anno, calcolati solo sulle righe valide
  // (indipendenti dal filtro «Solo le righe valide»).
  const totali = useMemo(() => {
    const m = new Map();
    (righe || []).filter((r) => r.valido).forEach((r) => {
      const k = `${r.ente}|${r.anno}`;
      const t = m.get(k) || { ente: r.ente, anno: r.anno, netti: 0, lordi: 0, n: 0 };
      t.netti += Number(r.crediti_netti) || 0;
      t.lordi += Number(r.crediti_lordi) || 0;
      t.n += 1;
      m.set(k, t);
    });
    return [...m.values()].sort((a, b) => a.ente.localeCompare(b.ente) || a.anno - b.anno);
  }, [righe]);
  const totaleNetti = totali.reduce((s, t) => s + t.netti, 0);

  // Scarica l'intero registro in CSV (tutte le righe, anche le sostituite,
  // a prescindere dal filtro). Nome file con la data di oggi (ora italiana).
  function esporta() {
    scaricaTesto(
      `registro_crediti_CWP_${oggiItalia()}.csv`,
      scriviCsv(
        ["Numero di registro", "Pratica", "Ente", "Anno", "Crediti lordi (tCO2eq)", "Buffer (%)", "Crediti netti (tCO2eq)", "Confermato il", "Confermato da", "Stato", "Sostituito da"],
        (righe || []).map((r) => [
          r.numero_registro, r.pratica_codice, r.ente, r.anno,
          Number(r.crediti_lordi), Number(r.buffer_pct), Number(r.crediti_netti),
          formatoData(r.confermato_il), r.confermato_da, r.valido ? "Valido" : "Sostituito", r.sostituito_da || "",
        ])
      )
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 12px", lineHeight: 1.5, maxWidth: 760 }}>
        Ogni calcolo <b>ex post confermato</b> riceve un numero di registro progressivo che non cambia e non si riusa.
        Se un calcolo viene corretto con una nuova versione confermata, la riga precedente resta come <i>Sostituito</i>:
        nei totali contano solo le righe <i>Valido</i>. Le stime ex ante non entrano nel registro.
      </p>
      {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{errore}</div>}

      {totali.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
          <div style={{ ...card, borderColor: C.green }}>
            <div style={{ fontSize: 12, color: C.grafite }}>Crediti netti registrati (validi)</div>
            <div style={{ fontFamily: "'Archivo'", fontSize: 20, fontWeight: 800, color: C.green }}>{fmt(totaleNetti)} <span style={{ fontSize: 12 }}>tCO₂eq</span></div>
          </div>
          {totali.map((t) => (
            <div key={`${t.ente}|${t.anno}`} style={card}>
              <div style={{ fontSize: 12, color: C.grafite }}>{t.ente} · {t.anno}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(t.netti)} <span style={{ fontSize: 11.5, fontWeight: 400 }}>tCO₂eq netti</span></div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={soloValidi} onChange={(e) => setSoloValidi(e.target.checked)} />
          Solo le righe valide
        </label>
        {righe?.length > 0 && <button onClick={esporta} style={btnMini}>Scarica il registro (CSV)</button>}
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
          <thead>
            <tr style={{ textAlign: "left", color: C.grafite, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.3 }}>
              <th style={th}>N. registro</th>
              <th style={th}>Pratica</th>
              <th style={th}>Anno</th>
              <th style={{ ...th, textAlign: "right" }}>Lordi</th>
              <th style={{ ...th, textAlign: "right" }}>Buffer</th>
              <th style={{ ...th, textAlign: "right" }}>Netti (tCO₂eq)</th>
              <th style={th}>Confermato</th>
              <th style={th}>Stato</th>
            </tr>
          </thead>
          <tbody>
            {righe === null && <tr><td colSpan={8} style={{ ...td, color: C.grafite }}>Caricamento…</td></tr>}
            {righe && visibili.length === 0 && <tr><td colSpan={8} style={{ ...td, color: C.grafite }}>Nessun calcolo registrato: il registro si popola alla conferma dei calcoli ex post.</td></tr>}
            {/* Clic sulla riga: apre il calcolo (/crediti/:id). */}
            {visibili.map((r) => (
              <tr key={r.numero_registro} onClick={() => navigate(`/crediti/${r.calcolo_id}`)} style={{ borderTop: `1px solid ${C.line}`, cursor: "pointer", opacity: r.valido ? 1 : 0.6 }}>
                <td style={{ ...td, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.numero_registro}</td>
                <td style={td}>{r.pratica_codice}<div style={{ fontSize: 11.5, color: C.grafite }}>{r.ente}</div></td>
                <td style={td}>{r.anno}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmt(r.crediti_lordi)}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmt(r.buffer_pct, 1)}%</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(r.crediti_netti)}</td>
                <td style={td}>{formatoData(r.confermato_il)}<div style={{ fontSize: 11.5, color: C.grafite }}>{r.confermato_da || "—"}</div></td>
                <td style={td}>
                  {r.valido
                    ? <Badge bg="#dfe9db" fg={C.green}>Valido</Badge>
                    : <Badge bg={C.paperWarm} fg={C.grafite}>Sostituito da {r.sostituito_da}</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Stili locali.
const card = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px" };
const btnMini = { background: C.white, color: C.green, border: `1px solid ${C.green}`, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const th = { padding: "10px 14px", fontWeight: 700 };
const td = { padding: "10px 14px", verticalAlign: "top" };
