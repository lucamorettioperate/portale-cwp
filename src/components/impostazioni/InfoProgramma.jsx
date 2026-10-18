/* =========================================================================
   InfoProgramma (Impostazioni)
   Scopo: informazioni del Programma pubblicate sulla pagina pubblica
     /programma (Guida al Programma 3.1 e 3.6): soggetto promotore del
     programma, PEC (anche per i reclami), email e sito ufficiale; e le
     metodologie approvate (Guida cap. 5), con il collegamento facoltativo
     a un modello pubblico che contiene il documento.
   Usato da: pagina Impostazioni (/impostazioni).
   Chi lo vede: admin.
   Dati: leggiInfoProgramma, impostaInfoProgramma, elencaMetodologie,
     salvaMetodologia, elencaModelli (src/lib/dati.js); tabelle impostazione
     (chiavi programma_*) e metodologia (script 24).
   Sicurezza (garantita dal database): scrive solo l'Amministratore
     (admin_imposta_info_programma, RLS metodologia_insert / _update);
     ogni modifica è nell'audit.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import { leggiInfoProgramma, impostaInfoProgramma, elencaMetodologie, salvaMetodologia, elencaModelli } from "../../lib/dati.js";
import { riquadro, campo, etichetta, btnPrimario, btnMini } from "../stili.js";

const CAMPI = [
  ["soggetto_promotore", "Soggetto promotore del programma"],
  ["pec", "PEC del Programma (anche per i reclami)"],
  ["email", "Email"],
  ["sito", "Sito ufficiale"],
];

/* Sezioni «Programma» e «Metodologie approvate». Nessuna prop. */
export default function InfoProgramma() {
  const [info, setInfo] = useState(null);
  const [esito, setEsito] = useState("");
  const [errore, setErrore] = useState("");
  const [metodologie, setMetodologie] = useState([]);
  const [modelli, setModelli] = useState([]);
  const [modulo, setModulo] = useState(null);

  async function carica() {
    const [{ data }, { data: m }, { data: mod }] = await Promise.all([leggiInfoProgramma(), elencaMetodologie(), elencaModelli({ tutti: true })]);
    setInfo(data || {});
    setMetodologie(m || []);
    setModelli((mod || []).filter((x) => x.pubblico));
  }
  useEffect(() => { carica(); }, []);

  // Salva solo i campi cambiati.
  async function salvaInfo(originale) {
    setErrore("");
    setEsito("");
    for (const [k] of CAMPI) {
      if ((info[k] || "") !== (originale[k] || "")) {
        const { error } = await impostaInfoProgramma(k, info[k] || "");
        if (error) return setErrore(error.message);
      }
    }
    setEsito("Salvato.");
    carica();
  }

  async function salvaMet() {
    setErrore("");
    if (!modulo.nome?.trim()) return setErrore("Indica il nome della metodologia.");
    const p = (v) => (v || "").trim() || null;
    const { error } = await salvaMetodologia({
      id: modulo.id, nome: modulo.nome.trim(), versione: p(modulo.versione), data_versione: modulo.data_versione || null,
      sviluppatore: p(modulo.sviluppatore), norma_riferimento: p(modulo.norma_riferimento), stato: modulo.stato || "approvata",
      descrizione: p(modulo.descrizione), modello_id: modulo.modello_id || null,
    });
    if (error) return setErrore(error.message);
    setModulo(null);
    carica();
  }
  const set = (k) => (e) => setModulo({ ...modulo, [k]: e.target.value });

  return (
    <>
      <InfoForm info={info} setInfo={setInfo} onSalva={salvaInfo} esito={esito} />
      <section style={{ ...riquadro, marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: 0 }}>Metodologie approvate</h2>
          {!modulo && <button onClick={() => setModulo({ stato: "approvata" })} style={btnPrimario}>+ Metodologia</button>}
        </div>
        {modulo && (
          <div style={{ margin: "12px 0", padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              <label style={etichetta}>Nome *<input value={modulo.nome || ""} onChange={set("nome")} style={campo} /></label>
              <label style={etichetta}>Versione<input value={modulo.versione || ""} onChange={set("versione")} style={campo} /></label>
              <label style={etichetta}>Data della versione<input type="date" value={modulo.data_versione || ""} onChange={set("data_versione")} style={campo} /></label>
              <label style={etichetta}>Sviluppatore<input value={modulo.sviluppatore || ""} onChange={set("sviluppatore")} style={campo} /></label>
              <label style={etichetta}>Norma di riferimento<input value={modulo.norma_riferimento || ""} onChange={set("norma_riferimento")} style={campo} /></label>
              <label style={etichetta}>Stato<select value={modulo.stato} onChange={set("stato")} style={campo}>{["approvata", "in revisione", "ritirata"].map((s) => <option key={s}>{s}</option>)}</select></label>
              <label style={etichetta}>Documento (modello pubblico)<select value={modulo.modello_id || ""} onChange={set("modello_id")} style={campo}><option value="">— nessuno —</option>{modelli.map((m) => <option key={m.id} value={m.id}>{m.titolo}</option>)}</select></label>
            </div>
            <label style={etichetta}>Descrizione<textarea rows={2} value={modulo.descrizione || ""} onChange={set("descrizione")} style={{ ...campo, resize: "vertical" }} /></label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={salvaMet} style={btnPrimario}>Salva</button>
              <button onClick={() => setModulo(null)} style={btnMini}>Annulla</button>
            </div>
          </div>
        )}
        {errore && <div style={{ color: C.red, fontSize: 12.5, margin: "8px 0" }}>{errore}</div>}
        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
          {metodologie.map((m) => (
            <div key={m.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13 }}>
                <b>{m.nome}</b> {m.versione && `v${m.versione}`} <span style={{ color: C.grafite }}>· {m.stato}</span>
                <div style={{ fontSize: 11.5, color: C.grafite }}>{[m.sviluppatore, m.norma_riferimento].filter(Boolean).join(" · ")}</div>
              </div>
              {!modulo && <button onClick={() => setModulo({ ...m })} style={btnMini}>Modifica</button>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* Modulo delle informazioni del Programma. Props: info, setInfo,
   onSalva(originale), esito. Tiene una copia dei valori letti per salvare
   solo quelli cambiati. */
function InfoForm({ info, setInfo, onSalva, esito }) {
  const [originale, setOriginale] = useState(null);
  useEffect(() => { if (info && !originale) setOriginale(info); }, [info, originale]);
  if (!info) return null;
  return (
    <section style={{ ...riquadro, marginBottom: 18 }}>
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 6px" }}>Il Programma (pagina pubblica)</h2>
      <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 12px", lineHeight: 1.5 }}>
        Compaiono sulla pagina pubblica /programma. Il soggetto promotore del programma è oggi lo Studio Associato Wastelab, che
        all'avvio della piattaforma incarica un soggetto giuridico (Guida 3.1): aggiornare il testo quando l'incarico è formalizzato.
      </p>
      {CAMPI.map(([k, label]) => (
        <label key={k} style={etichetta}>
          {label}
          {k === "soggetto_promotore"
            ? <textarea rows={2} value={info[k] || ""} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} style={{ ...campo, resize: "vertical" }} />
            : <input value={info[k] || ""} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} style={campo} />}
        </label>
      ))}
      <button onClick={() => { onSalva(originale || {}); setOriginale(null); }} style={btnPrimario}>Salva</button>
      {esito && <span style={{ color: C.green, fontSize: 12.5, marginLeft: 10 }}>{esito}</span>}
    </section>
  );
}
