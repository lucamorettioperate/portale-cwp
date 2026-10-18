import React, { useEffect, useRef, useState } from "react";
import { COLORI as C, FASI } from "../../lib/cwpProgram.js";
import Badge from "../Badge.jsx";
import { elencaModelli, caricaModello, aggiornaModello, urlModello } from "../../lib/dati.js";
import { ACCEPT, FORMATI_LEGGIBILI } from "../../lib/file.js";
import { riquadro, campo, etichetta, btnPrimario, btnMini, btnLink } from "../stili.js";

/* Modelli di documento (backlog 12) — Impostazioni, solo Amministratori.
   L'Amministratore carica i modelli che i Comuni scaricano: un modello può
   valere per una fase (compare dentro quella fase in ogni pratica) o essere
   generale (compare in «I tuoi documenti»). Per aggiornare un modello se ne
   carica uno nuovo e si ritira il vecchio: i file non si sovrascrivono.
   Archivio "modelli" e regole di accesso: script 17. */
export default function ModelliDocumento() {
  const [modelli, setModelli] = useState([]);
  const [modulo, setModulo] = useState(null);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const inputRef = useRef(null);

  async function carica() {
    const { data, error } = await elencaModelli({ tutti: true });
    if (error) setErrore(error.message);
    setModelli(data || []);
  }
  useEffect(() => { carica(); }, []);

  async function salva() {
    setErrore("");
    const file = inputRef.current?.files?.[0];
    if ((modulo.titolo || "").trim().length < 3) return setErrore("Indica un titolo (almeno 3 caratteri).");
    if (!file) return setErrore("Scegli il file del modello.");
    setInCorso(true);
    const { error } = await caricaModello({
      file,
      titolo: modulo.titolo.trim(),
      descrizione: (modulo.descrizione || "").trim() || null,
      faseNumero: modulo.fase ? Number(modulo.fase) : null,
    });
    setInCorso(false);
    if (error) return setErrore("Modello non caricato: " + error.message);
    setModulo(null);
    carica();
  }

  async function cambiaAttivo(m, attivo) {
    setErrore("");
    const { error } = await aggiornaModello(m.id, { attivo });
    if (error) setErrore(error.message);
    carica();
  }

  async function scarica(m) {
    const { data } = await urlModello(m.storage_path);
    if (data?.signedUrl) window.location.href = data.signedUrl;
  }

  const nomeFase = (n) => (n ? `Fase ${n} · ${FASI.find((f) => f.numero === n)?.nome || ""}` : "Generale");

  return (
    <section style={{ ...riquadro, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: 0 }}>Modelli di documento</h2>
        {!modulo && <button onClick={() => setModulo({ titolo: "", descrizione: "", fase: "" })} style={btnPrimario}>+ Nuovo modello</button>}
      </div>
      <p style={{ fontSize: 13, color: C.grafite, margin: "6px 0 14px", lineHeight: 1.5 }}>
        Moduli e fac-simile che i Comuni scaricano dal portale. Un modello legato a una fase compare dentro quella
        fase in ogni pratica; un modello generale compare in «I tuoi documenti».
      </p>

      {modelli.length === 0 && !modulo && <div style={{ fontSize: 13, color: C.grafite }}>Nessun modello caricato.</div>}
      <div style={{ display: "grid", gap: 6 }}>
        {modelli.map((m) => (
          <div key={m.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", opacity: m.attivo ? 1 : 0.6 }}>
            <div style={{ fontSize: 13, minWidth: 0 }}>
              <b>{m.titolo}</b> <span style={{ color: C.grafite }}>· {nomeFase(m.fase_numero)}</span>
              <div style={{ fontSize: 11.5, color: C.grafite }}>
                <button onClick={() => scarica(m)} style={{ ...btnLink, fontSize: 11.5 }}>{m.nome_file}</button>
                {m.descrizione && <> · {m.descrizione}</>}
                {" · "}caricato il {new Date(m.creato_il).toLocaleDateString("it-IT")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {m.attivo
                ? <Badge bg={C.greenSoft} fg={C.green}>pubblicato</Badge>
                : <Badge bg={C.paperWarm} fg={C.grafite}>ritirato</Badge>}
              <button onClick={() => cambiaAttivo(m, !m.attivo)} style={btnMini}>{m.attivo ? "Ritira" : "Ripubblica"}</button>
            </div>
          </div>
        ))}
      </div>

      {modulo && (
        <div style={{ marginTop: 12, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            <label style={etichetta}>Titolo *<input value={modulo.titolo} onChange={(e) => setModulo({ ...modulo, titolo: e.target.value })} style={campo} placeholder="Es. Modulo di adesione" /></label>
            <label style={etichetta}>
              Dove compare
              <select value={modulo.fase} onChange={(e) => setModulo({ ...modulo, fase: e.target.value })} style={campo}>
                <option value="">Generale (I tuoi documenti)</option>
                {FASI.map((f) => <option key={f.numero} value={f.numero}>Fase {f.numero} · {f.nome}</option>)}
              </select>
            </label>
          </div>
          <label style={etichetta}>Descrizione (facoltativa)<input value={modulo.descrizione} onChange={(e) => setModulo({ ...modulo, descrizione: e.target.value })} style={campo} placeholder="Es. Da compilare, firmare e caricare nella fase 1" /></label>
          <label style={etichetta}>
            File *
            <input ref={inputRef} type="file" accept={ACCEPT} style={{ fontSize: 13 }} />
            <span style={{ fontWeight: 400, fontSize: 11.5 }}>Formati accettati: {FORMATI_LEGGIBILI}</span>
          </label>
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={salva} disabled={inCorso} style={btnPrimario}>{inCorso ? "Caricamento…" : "Carica e pubblica"}</button>
            <button onClick={() => { setModulo(null); setErrore(""); }} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}
      {!modulo && errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}
    </section>
  );
}
