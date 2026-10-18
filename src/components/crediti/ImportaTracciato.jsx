import React, { useEffect, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import { elencaDocumenti, urlDocumento } from "../../lib/dati.js";
import { formatoData } from "../../lib/date.js";
import { leggiFileTracciato, controllaPrivacy, interpretaTracciato, controllaCoerenza } from "../../lib/crediti/tracciato.js";

/* =========================================================================
   Passo «Importa il tracciato» del calcolo dei crediti (backlog 1-5).
   L'Amministratore sceglie il tracciato dati del Comune:
   - dai documenti della pratica del calcolo (file .xlsx o .zip caricati dal
     Comune), oppure dal proprio computer;
   il portale lo legge nel browser (src/lib/crediti/tracciato.js), blocca il
   file se contiene dati personali, mostra un'anteprima con conteggi, righe
   scartate e controlli di coerenza, e solo alla conferma sostituisce nel
   calcolo le parti scelte. Nulla viene salvato prima della conferma.
   ========================================================================= */
export default function ImportaTracciato({ calcolo, anno, ps, sola, ultima, onImporta }) {
  const [documenti, setDocumenti] = useState([]);
  const [stato, setStato] = useState(null); // { lettura } | { errore } | { anteprima }
  const [parti, setParti] = useState({ anagrafica: true, rifiuti: true, delibera: true, utenze: true, riuso: true });
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    if (!calcolo?.pratica_id) return;
    elencaDocumenti(calcolo.pratica_id).then(({ data }) =>
      setDocumenti((data || []).filter((d) => /\.(xlsx|zip)$/i.test(d.storage_path || d.nome)))
    );
  }, [calcolo?.pratica_id]);

  async function analizza(buffer, origine) {
    setStato({ lettura: `Lettura di «${origine.nome}»…` });
    try {
      const { fogli } = await leggiFileTracciato(buffer, origine.nome);
      const privacy = controllaPrivacy(fogli);
      if (privacy.length) {
        setStato({ privacy, origine });
        return;
      }
      const t = interpretaTracciato(fogli, anno);
      const coerenza = controllaCoerenza({
        anno,
        anagrafica: t.anagrafica,
        rifiuti: t.rifiuti,
        pefUd: t.anagrafica.pefUd,
        pefUnd: t.anagrafica.pefUnd,
        classiUd: t.classiUd,
        classiUnd: t.classiUnd,
        conferimenti: t.conferimenti,
        riuso: t.riuso,
        ps,
      });
      setStato({ anteprima: t, coerenza, origine });
    } catch (e) {
      setStato({ errore: e.message || "File non leggibile: è il tracciato dati CWP in formato Excel (.xlsx) o ZIP di CSV?" });
    }
  }

  async function daComputer(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    analizza(await file.arrayBuffer(), { nome: file.name, tipo: "computer" });
  }

  async function daPratica(d) {
    setStato({ lettura: `Scaricamento di «${d.nome}»…` });
    const { data } = await urlDocumento(d.storage_path);
    if (!data?.signedUrl) return setStato({ errore: "Il file non è scaricabile." });
    const r = await fetch(data.signedUrl);
    if (!r.ok) return setStato({ errore: "Il file non è scaricabile." });
    analizza(await r.arrayBuffer(), { nome: `${d.nome} (v${d.versione})`, tipo: "pratica", documentoId: d.id, hash: d.hash_file });
  }

  async function applica() {
    setInCorso(true);
    await onImporta({ tracciato: stato.anteprima, parti, origine: stato.origine });
    setInCorso(false);
    setStato(null);
  }

  const a = stato?.anteprima;
  const errori = stato?.coerenza?.filter((x) => x.livello === "errore") || [];
  const avvisi = stato?.coerenza?.filter((x) => x.livello === "avviso") || [];

  return (
    <div>
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 4px" }}>Importa il tracciato dati</h2>
      <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 14px", lineHeight: 1.5 }}>
        Il file Excel del tracciato dati CWP (o lo ZIP con i fogli in CSV) compila in un colpo solo i passi 2, 3 e 5
        e la ripartizione PEF. Le singole letture del foglio 6_Letture sono sommate per utenza e tipologia. Prima
        dell'import il portale controlla che non ci siano dati personali e che i dati siano coerenti.
      </p>

      {ultima && (
        <div style={{ fontSize: 12.5, color: C.grafite, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
          Ultimo import: <b style={{ color: C.ink }}>{ultima.file}</b> il {new Date(ultima.importatoIl).toLocaleString("it-IT")}
          {ultima.conteggi && <> · {ultima.conteggi.conferimenti} righe della Banca Dati, {ultima.conteggi.utenze} utenze</>}
        </div>
      )}
      {sola && <div style={{ fontSize: 13, color: C.grafite }}>Calcolo confermato: i dati non si possono più importare.</div>}

      {!sola && !a && !stato?.privacy && (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.grafite, marginBottom: 6 }}>Dai documenti della pratica</div>
            {documenti.length === 0 && <div style={{ fontSize: 13, color: C.grafite }}>Nessun file .xlsx o .zip nella pratica di questo calcolo.</div>}
            <div style={{ display: "grid", gap: 6 }}>
              {documenti.map((d) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 12px", opacity: d.corrente === false ? 0.7 : 1 }}>
                  <span style={{ fontSize: 13 }}>
                    <b>{d.nome}</b> · v{d.versione} · {formatoData(d.creato_il)}
                    {d.corrente === false && <span style={{ color: C.grafite }}> · versione precedente</span>}
                  </span>
                  <button onClick={() => daPratica(d)} style={btnMini}>Leggi questo file</button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.grafite, marginBottom: 6 }}>Oppure dal computer</div>
            <label style={{ ...btnMini, display: "inline-block" }}>
              Scegli il file (.xlsx o .zip)
              <input type="file" accept=".xlsx,.zip" onChange={daComputer} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      )}

      {stato?.lettura && <div style={{ fontSize: 13, color: C.green, marginTop: 12 }}>{stato.lettura}</div>}
      {stato?.errore && <div style={{ fontSize: 13, color: C.red, marginTop: 12 }}>{stato.errore}</div>}

      {/* Dati personali: import bloccato */}
      {stato?.privacy && (
        <div style={{ border: `1px solid ${C.red}`, background: "#f6dcd6", borderRadius: 10, padding: "12px 14px", marginTop: 12 }}>
          <b style={{ color: C.red }}>Import bloccato: il file contiene dati personali.</b>
          <p style={{ fontSize: 13, margin: "6px 0 8px", lineHeight: 1.5 }}>
            Il tracciato deve indicare ogni utenza con un codice anonimo, senza nomi, indirizzi, codici fiscali, email o
            telefoni. Chiedete al Comune di sostituirli e di caricare di nuovo il file. Il file non è stato importato.
          </p>
          <ul style={{ fontSize: 12.5, margin: 0, paddingLeft: 18 }}>
            {stato.privacy.slice(0, 10).map((p, i) => (
              <li key={i}>{p.foglio}, riga {p.riga}: {p.tipo} ({p.esempio})</li>
            ))}
            {stato.privacy.length > 10 && <li>… e altri {stato.privacy.length - 10}</li>}
          </ul>
          <button onClick={() => setStato(null)} style={{ ...btnMini, marginTop: 10 }}>Chiudi</button>
        </div>
      )}

      {/* Anteprima */}
      {a && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            File: <b>{stato.origine.nome}</b>
            {a.anagrafica.ente && <> · {a.anagrafica.ente}</>}
            {a.anagrafica.anno && <> · anno dei dati {a.anagrafica.anno}</>}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
            <tbody>
              {[
                ["anagrafica", "Ripartizione PEF e tariffa puntuale (1_Anagrafica)", a.anagrafica.pefUd != null ? `PEF ${a.anagrafica.pefUd}% / ${a.anagrafica.pefUnd ?? "—"}% · tariffa puntuale ${a.anagrafica.tariffaPuntuale ? "sì" : "no"}` : "non compilata"],
                ["rifiuti", "Rifiuti del territorio (2_Rifiuti) → passo 2", `${a.conteggi.rifiuti} codici EER`],
                ["delibera", "Classi della delibera (fogli 3 e 4) → passo 3", `${a.conteggi.classiUd} domestiche · ${a.conteggi.classiUnd} non domestiche`],
                ["utenze", `Banca Dati Utenze (${a.conteggi.letture ? "6_Letture, sommate" : "5_Conferimenti"}) → passo 5`, `${a.conteggi.conferimenti.toLocaleString("it-IT")} righe · ${a.conteggi.utenze.toLocaleString("it-IT")} utenze${a.conteggi.letture ? ` · da ${a.conteggi.lettureUsate.toLocaleString("it-IT")} letture` : ""}`],
                ["riuso", "Beni a riuso (7_Riuso) → passo 5", `${a.conteggi.riuso} righe`],
              ].map(([k, etichetta, valore]) => (
                <tr key={k} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: "7px 8px", width: 28 }}>
                    <input type="checkbox" checked={parti[k]} onChange={(e) => setParti({ ...parti, [k]: e.target.checked })} aria-label={`Importa: ${etichetta}`} />
                  </td>
                  <td style={{ padding: "7px 8px" }}>{etichetta}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: C.grafite }}>{valore}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {a.errori.length > 0 && <Elenco titolo="Fogli non letti" colore={C.red} voci={a.errori} />}
          {a.scartiTotali > 0 && <Elenco titolo={`Righe scartate (${a.scartiTotali.toLocaleString("it-IT")})`} colore={C.amber} voci={a.scarti.slice(0, 12)} altre={a.scartiTotali - 12} />}
          {a.avvisi.length > 0 && <Elenco titolo="Da sapere" colore={C.grafite} voci={a.avvisi} />}
          {errori.length > 0 && <Elenco titolo="Incoerenze da correggere" colore={C.red} voci={errori.map((x) => x.testo)} />}
          {avvisi.length > 0 && <Elenco titolo="Valori da verificare" colore={C.amber} voci={avvisi.map((x) => x.testo)} />}
          {!errori.length && !avvisi.length && !a.scartiTotali && <div style={{ fontSize: 13, color: C.green, marginBottom: 10 }}>Nessuna incoerenza trovata.</div>}

          <p style={{ fontSize: 12.5, color: C.grafite, margin: "4px 0 10px" }}>
            L'import sostituisce nel calcolo le parti spuntate e salva subito. Le incoerenze non bloccano l'import: si
            possono correggere nei passi oppure chiedendo al Comune un file nuovo.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={applica} disabled={inCorso || !Object.values(parti).some(Boolean)} style={btnPrimario}>
              {inCorso ? "Import in corso…" : "Importa nel calcolo"}
            </button>
            <button onClick={() => setStato(null)} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Riquadro dei controlli di coerenza sui dati attuali del calcolo
   (mostrato nel passo 5 e nei risultati). */
export function ControlliCoerenza({ esiti }) {
  if (!esiti) return null;
  const errori = esiti.filter((x) => x.livello === "errore");
  const avvisi = esiti.filter((x) => x.livello === "avviso");
  if (!errori.length && !avvisi.length) {
    return <div style={{ fontSize: 13, color: C.green, margin: "0 0 12px" }}>Controlli di coerenza: nessuna incoerenza trovata.</div>;
  }
  return (
    <div style={{ marginBottom: 12 }}>
      {errori.length > 0 && <Elenco titolo="Controlli di coerenza — da correggere" colore={C.red} voci={errori.map((x) => x.testo)} />}
      {avvisi.length > 0 && <Elenco titolo="Controlli di coerenza — da verificare" colore={C.amber} voci={avvisi.map((x) => x.testo)} />}
    </div>
  );
}

function Elenco({ titolo, colore, voci, altre = 0 }) {
  return (
    <div style={{ borderLeft: `3px solid ${colore}`, background: C.paper, borderRadius: 6, padding: "8px 12px", marginBottom: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: colore, marginBottom: 4 }}>{titolo}</div>
      <ul style={{ fontSize: 12.5, margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
        {voci.map((v, i) => <li key={i}>{v}</li>)}
        {altre > 0 && <li>… e altre {altre.toLocaleString("it-IT")}</li>}
      </ul>
    </div>
  );
}

const btnPrimario = { background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnMini = { background: C.white, color: C.green, border: `1px solid ${C.green}`, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
