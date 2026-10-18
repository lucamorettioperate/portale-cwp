/* =========================================================================
   CreditiEmessi
   Scopo: crediti di carbonio emessi da un Rapporto di Monitoraggio
     registrato (Guida al Programma 6.3.2 e 6.3.3, Tabella 5; Standard
     6.2; script 24):
     - emissione di un lotto con ID univoci (solo Amministratori), anche
       collegata a un calcolo ex post confermato (il totale non supera i
       crediti netti);
     - caricamento del lotto sul registro scelto dal promotore del progetto;
     - vendite comunicate dal registro (Comunicazione di vendita:
       quantità, beneficiario, obiettivo di compensazione, data, valore),
       con la proposta della voce di pagamento «tariffa di vendita»;
     - dichiarazione di cancellazione tombale: i crediti venduti passano a
       «ritirato» (va ricevuta entro 10 giorni dalla vendita: il database
       avvisa lo staff se manca).
     Stato dei crediti come sul registro: «attivo» (disponibile alla
     vendita) o «ritirato» (cancellato).
   Usato da: DettaglioPratica.jsx (Rapporti) e pagina CreditiEmessi
     (/crediti-emessi, elenco di tutti i lotti per lo staff).
   Chi lo vede: Comune (sola lettura dei propri), operatore (registro,
     vendite, cancellazioni), admin (anche l'emissione).
   Dati: elencaLotti, emettiCrediti, caricaSuRegistro, registraVendita,
     registraCancellazione, elencaRegistri, elencaCalcoliConfermati,
     elencaDocumenti, salvaPagamento (src/lib/dati.js); tariffaVendita
     (src/lib/tariffe.js).
   Sicurezza (garantita dal database, script 24): si scrive solo con le
     funzioni admin_emetti_crediti e staff_*; l'emissione richiede il
     Rapporto registrato (fase 6 completata) e Rapporto e Progetto non
     sospesi, annullati o ritirati; le vendite non superano il lotto.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Badge from "./Badge.jsx";
import {
  elencaLotti,
  emettiCrediti,
  caricaSuRegistro,
  registraVendita,
  registraCancellazione,
  elencaRegistri,
  elencaCalcoliConfermati,
  elencaDocumenti,
  salvaPagamento,
} from "../lib/dati.js";
import { tariffaVendita, tariffaEmissione } from "../lib/tariffe.js";
import { formatoData, oggiItalia, aggiungiGiorni, giorniA } from "../lib/date.js";
import { riquadro, campo, etichetta, btnPrimario, btnMini } from "./stili.js";

const num = (n) => Number(n || 0).toLocaleString("it-IT");

// Riepilogo di un lotto calcolato dalle vendite (stesso calcolo di
// cwp_riepilogo_lotto nel database).
export function riepilogoLotto(l) {
  const vendite = l.vendite || [];
  const venduti = vendite.reduce((s, v) => s + v.quantita, 0);
  const ritirati = vendite.filter((v) => v.cancellato_il).reduce((s, v) => s + v.quantita, 0);
  const attivi = l.registro_id ? l.quantita - ritirati : 0;
  return { venduti, ritirati, attivi, daVendere: l.quantita - venduti };
}

/* Riquadro dei crediti di un Rapporto. Props: rapporto (pratica di tipo
   rapporto con le fasi), onCambio() facoltativa. */
export default function CreditiEmessi({ rapporto, onCambio }) {
  const { ruolo } = useAuth();
  const admin = ruolo === "admin";
  const staff = admin || ruolo === "operatore";
  const [lotti, setLotti] = useState([]);
  const [modulo, setModulo] = useState(null); // emissione
  const [calcoli, setCalcoli] = useState([]);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  const registrato = (rapporto.fasi || []).some((f) => f.numero === 6 && f.stato === "completata");

  async function carica() {
    const { data } = await elencaLotti(rapporto.id);
    setLotti(data || []);
  }
  useEffect(() => { carica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rapporto.id]);

  async function apriEmissione() {
    setErrore("");
    const { data } = await elencaCalcoliConfermati();
    setCalcoli((data || []).filter((c) => c.pratica_id === rapporto.id || c.pratica_id === rapporto.progetto_padre_id));
    setModulo({ quantita: "", calcolo: "", note: "", voce: true });
  }

  // Emette il lotto e, se scelto, aggiunge la voce di pagamento della
  // tariffa di emissione (Schema tariffario, scadenza a 30 giorni).
  async function emetti() {
    setErrore("");
    const quantita = parseInt(modulo.quantita, 10);
    if (!quantita || quantita <= 0) return setErrore("Indica il numero di crediti.");
    setInCorso(true);
    const { data, error } = await emettiCrediti(rapporto.id, quantita, modulo.calcolo || null, modulo.note.trim() || null);
    if (!error && modulo.voce) {
      await salvaPagamento({
        pratica_id: rapporto.id, voce: "emissione", descrizione: `Emissione dei crediti ${data?.codice || ""}`.trim(),
        importo: tariffaEmissione(quantita), scadenza: aggiungiGiorni(oggiItalia(), 30), pagato: false, data_pagamento: null, riferimento: null,
      });
    }
    setInCorso(false);
    if (error) return setErrore(error.message);
    setModulo(null);
    carica();
    onCambio && onCambio();
  }

  const calcoloScelto = calcoli.find((c) => c.id === modulo?.calcolo);

  return (
    <section style={riquadro}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: 0 }}>Crediti emessi</h3>
        {admin && !modulo && registrato && rapporto.stato === "attiva" && (
          <button onClick={apriEmissione} style={btnPrimario}>+ Emetti crediti</button>
        )}
      </div>
      {!registrato && (
        <p style={{ fontSize: 13, color: C.grafite, margin: "8px 0 0" }}>
          I crediti si emettono dopo la registrazione del Rapporto (seconda verifica documentale completata).
        </p>
      )}
      {modulo && (
        <div style={{ marginTop: 12, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            <label style={etichetta}>
              Calcolo ex post confermato (facoltativo)
              <select value={modulo.calcolo} onChange={(e) => setModulo({ ...modulo, calcolo: e.target.value })} style={campo}>
                <option value="">— nessuno —</option>
                {calcoli.map((c) => (
                  <option key={c.id} value={c.id}>{c.numero_registro || c.titolo} · {num(Math.floor(c.crediti_netti || 0))} crediti netti</option>
                ))}
              </select>
            </label>
            <label style={etichetta}>
              Crediti da emettere (tCO₂eq)
              <input type="number" min="1" value={modulo.quantita} onChange={(e) => setModulo({ ...modulo, quantita: e.target.value })} style={campo}
                placeholder={calcoloScelto ? String(Math.floor(calcoloScelto.crediti_netti || 0)) : ""} />
            </label>
          </div>
          <label style={etichetta}>
            Note (es. estremi del Rapporto di verifica e della Dichiarazione dell'ente)
            <input value={modulo.note} onChange={(e) => setModulo({ ...modulo, note: e.target.value })} style={campo} />
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, marginBottom: 10 }}>
            <input type="checkbox" checked={modulo.voce} onChange={(e) => setModulo({ ...modulo, voce: e.target.checked })} />
            Aggiungi la voce di pagamento della tariffa di emissione
            {parseInt(modulo.quantita, 10) > 0 && <b> ({tariffaEmissione(parseInt(modulo.quantita, 10)).toLocaleString("it-IT", { style: "currency", currency: "EUR" })})</b>}
          </label>
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={emetti} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Emetti"}</button>
            <button onClick={() => setModulo(null)} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}
      {!modulo && errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {lotti.map((l) => <Lotto key={l.id} lotto={l} staff={staff} onCambio={carica} />)}
        {registrato && lotti.length === 0 && <div style={{ fontSize: 13, color: C.grafite }}>Nessun credito emesso.</div>}
      </div>
    </section>
  );
}

/* Un lotto di crediti con le sue vendite e le azioni dello staff.
   Props: lotto (riga di credito_lotto con registro e vendite), staff,
   onCambio(), mostraRapporto (nell'elenco di tutti i lotti). */
export function Lotto({ lotto: l, staff, onCambio, mostraRapporto = false }) {
  const [form, setForm] = useState(null); // null | { tipo: "registro" | "vendita" | "cancellazione", ... }
  const [registri, setRegistri] = useState([]);
  const [documenti, setDocumenti] = useState([]);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const r = riepilogoLotto(l);

  async function apri(tipo, extra = {}) {
    setErrore("");
    if (tipo === "registro") {
      const { data } = await elencaRegistri();
      setRegistri((data || []).filter((x) => x.attivo));
    } else {
      const { data } = await elencaDocumenti(l.rapporto_id);
      setDocumenti((data || []).filter((d) => d.corrente));
    }
    setForm({ tipo, data: oggiItalia(), quantita: "", beneficiario: "", obiettivo: "", valore: "", documento: "", registro: "", voce: true, ...extra });
  }

  async function conferma() {
    setErrore("");
    setInCorso(true);
    let esito;
    if (form.tipo === "registro") {
      esito = await caricaSuRegistro(l.id, form.registro || null, form.data || null);
    } else if (form.tipo === "vendita") {
      const quantita = parseInt(form.quantita, 10);
      const valore = form.valore === "" ? null : Number(String(form.valore).replace(/\./g, "").replace(",", "."));
      esito = await registraVendita({
        lottoId: l.id, quantita, data: form.data, beneficiario: form.beneficiario.trim(),
        obiettivo: form.obiettivo.trim() || null, valore, comunicazioneId: form.documento || null,
      });
      // Tariffa di vendita: 20% del valore, non meno del minimo a scaglioni.
      if (!esito.error && form.voce) {
        await salvaPagamento({
          pratica_id: l.rapporto_id, voce: "vendita", descrizione: `Vendita di ${num(quantita)} crediti (${l.codice})`,
          importo: tariffaVendita(quantita, valore || 0), scadenza: aggiungiGiorni(oggiItalia(), 30), pagato: false, data_pagamento: null, riferimento: null,
        });
      }
    } else {
      esito = await registraCancellazione(form.vendita, form.documento || null, form.data || null);
    }
    setInCorso(false);
    if (esito.error) return setErrore(esito.error.message);
    setForm(null);
    onCambio && onCambio();
  }

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13 }}>
          <b>{l.codice}</b> · {num(l.quantita)} crediti emessi il {formatoData(l.data_emissione)}
          {mostraRapporto && l.rapporto && <span style={{ color: C.grafite }}> · {l.rapporto.organizzazione?.denominazione} · Rapporto anno {l.rapporto.anno_monitoraggio}</span>}
          <div style={{ fontSize: 11.5, color: C.grafite }}>
            ID da {l.id_primo} a {l.id_ultimo}
            {l.registro ? ` · Registro: ${l.registro.denominazione} dal ${formatoData(l.caricato_il)}` : ""}
            {l.note ? ` · ${l.note}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {!l.registro_id ? <Badge bg={C.ocraSoft} fg={C.amber}>da caricare sul registro</Badge> : <Badge bg={C.greenSoft} fg={C.green}>attivi {num(r.attivi)}</Badge>}
          {r.ritirati > 0 && <Badge bg="#efe3e0" fg="#7a4a3f">ritirati {num(r.ritirati)}</Badge>}
        </div>
      </div>

      {(l.vendite || []).map((v) => {
        const ritardo = !v.cancellato_il && giorniA(v.data_vendita) < -10;
        return (
          <div key={v.id} style={{ fontSize: 12.5, marginTop: 6, paddingLeft: 10, borderLeft: `3px solid ${C.line}` }}>
            Vendita del {formatoData(v.data_vendita)}: <b>{num(v.quantita)}</b> crediti a {v.beneficiario}
            {v.obiettivo_compensazione ? ` (${v.obiettivo_compensazione})` : ""}
            <span style={{ color: C.grafite }}> · ID da {v.id_primo} a {v.id_ultimo}</span>
            <div style={{ color: v.cancellato_il ? C.green : ritardo ? C.red : C.grafite }}>
              {v.cancellato_il
                ? `Ritirati: cancellazione tombale del ${formatoData(v.cancellato_il)}`
                : ritardo
                  ? "Manca la dichiarazione di cancellazione (attesa entro 10 giorni dalla vendita)"
                  : "In attesa della dichiarazione di cancellazione del registro"}
              {staff && !v.cancellato_il && !form && (
                <button onClick={() => apri("cancellazione", { vendita: v.id })} style={{ ...btnMini, marginLeft: 8, padding: "3px 8px" }}>Registra la cancellazione</button>
              )}
            </div>
          </div>
        );
      })}

      {staff && !form && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {!l.registro_id && <button onClick={() => apri("registro")} style={btnMini}>Carica sul registro</button>}
          {l.registro_id && r.daVendere > 0 && <button onClick={() => apri("vendita")} style={btnMini}>Registra una vendita ({num(r.daVendere)} disponibili)</button>}
        </div>
      )}

      {form && (
        <div style={{ marginTop: 10, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
            {form.tipo === "registro" && (
              <label style={etichetta}>
                Registro scelto dal promotore
                <select value={form.registro} onChange={(e) => setForm({ ...form, registro: e.target.value })} style={campo}>
                  <option value="">— scegli —</option>
                  {registri.map((x) => <option key={x.id} value={x.id}>{x.denominazione}</option>)}
                </select>
                {registri.length === 0 && <span style={{ fontWeight: 400 }}>Nessun registro: si censiscono in Anagrafiche.</span>}
              </label>
            )}
            {form.tipo === "vendita" && (
              <>
                <label style={etichetta}>Crediti venduti<input type="number" min="1" value={form.quantita} onChange={(e) => setForm({ ...form, quantita: e.target.value })} style={campo} /></label>
                <label style={etichetta}>Beneficiario<input value={form.beneficiario} onChange={(e) => setForm({ ...form, beneficiario: e.target.value })} style={campo} /></label>
                <label style={etichetta}>Obiettivo di compensazione<input value={form.obiettivo} onChange={(e) => setForm({ ...form, obiettivo: e.target.value })} style={campo} /></label>
                <label style={etichetta}>Valore di vendita (€)<input inputMode="decimal" value={form.valore} onChange={(e) => setForm({ ...form, valore: e.target.value })} style={campo} /></label>
              </>
            )}
            {(form.tipo === "vendita" || form.tipo === "cancellazione") && (
              <label style={etichetta}>
                {form.tipo === "vendita" ? "Comunicazione di vendita (documento del Rapporto)" : "Dichiarazione di cancellazione tombale"}
                <select value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} style={campo}>
                  <option value="">{form.tipo === "vendita" ? "— facoltativo —" : "— scegli —"}</option>
                  {documenti.map((d) => <option key={d.id} value={d.id}>{d.nome} (v{d.versione}){d.tipologia ? ` · ${d.tipologia}` : ""}</option>)}
                </select>
              </label>
            )}
            <label style={etichetta}>Data<input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} style={campo} /></label>
          </div>
          {form.tipo === "vendita" && (
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, marginBottom: 10 }}>
              <input type="checkbox" checked={form.voce} onChange={(e) => setForm({ ...form, voce: e.target.checked })} />
              Aggiungi la voce di pagamento della tariffa di vendita (20% del valore, con il minimo dello Schema tariffario)
            </label>
          )}
          {form.tipo !== "registro" && (
            <div style={{ fontSize: 11.5, color: C.grafite, marginBottom: 8 }}>
              Il documento va prima caricato tra i documenti del Rapporto; scelto qui diventa pubblico (Guida, Tabella 5).
            </div>
          )}
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={conferma} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Conferma"}</button>
            <button onClick={() => setForm(null)} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}
