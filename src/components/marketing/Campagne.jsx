/* =========================================================================
   Campagne — campagne email della sezione Marketing (richiesta di Luca
   Moretti del 23/10/2026, script 44 e funzione del server «marketing»).
   - Elenco delle campagne con lo stato degli invii (inviati, errori,
     visite alla landing page, simulazioni, richieste di registrazione).
   - Modulo della campagna: titolo, oggetto, testo, grafica
     dell'intestazione, anteprima dell'email (htmlCampagna di
     src/lib/marketing.js, la stessa che spedisce il server).
   - Destinatari: si scelgono per ogni campagna (Comuni e/o gestori,
     regioni, abitanti, natura e attività dei gestori); entrano solo gli
     enti con email GENERICA (mai PEC) e non disiscritti.
   - «Invia una prova a me» e «Invia la campagna» (a blocchi di 50, uno
     ogni 0,6 secondi: limite di Resend).
   Props: regioni (elenco dei nomi).
   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import { htmlCampagna, GRAFICHE_CAMPAGNA } from "../../lib/marketing.js";
import {
  elencaCampagne, leggiCampagna, salvaCampagna, eliminaCampagna, statoInvii, ultimiErrori, preparaInvii, togliInviiDaInviare, idEntiFiltrati, azioneMarketing,
} from "../../lib/marketingDati.js";
import { campo, btnPrimario, btnMini } from "../stili.js";

export const TESTO_PREDEFINITO = `Gentile Amministrazione,

la Fondazione Operate gestisce il Programma Carbon WastePrint®, che dà un valore economico ai risultati del Comune nella riduzione dei rifiuti: ogni tonnellata evitata rispetto allo scenario di riferimento diventa crediti di carbonio certificati, venduti sul mercato volontario.

Aderendo, il Comune ottiene risorse economiche ogni anno per tutta la durata del progetto: 7 anni rinnovabili, 10 anni oppure fino a 21 anni. Risorse da reinvestire nel servizio di igiene urbana, nella riduzione della tariffa per cittadini e imprese e in progetti per il territorio.

Il percorso è seguito dalla Fondazione in ogni passaggio: raccolta dei dati, calcolo con la Metodologia certificata, validazione di un ente terzo, registrazione e vendita dei crediti. Il Comune segue tutto da un portale dedicato, con dati misurati utili anche alla comunicazione ai cittadini.

Con il pulsante qui sotto può simulare in due minuti costi e ricavi per il suo Comune e, se lo desidera, chiedere di essere ricontattato dalla Fondazione.`;

const vuota = () => ({ titolo: "Invito al Programma Carbon WastePrint", oggetto: "Rifiuti evitati, risorse per il Comune: il Programma Carbon WastePrint®", testo: TESTO_PREDEFINITO, grafica: "risorse", target: {} });
const num = (n) => Number(n || 0).toLocaleString("it-IT");

export default function Campagne({ regioni }) {
  const [elenco, setElenco] = useState([]);
  const [aperta, setAperta] = useState(null);
  const [errore, setErrore] = useState("");

  async function carica() {
    const { data, error } = await elencaCampagne();
    setErrore(error ? error.message : "");
    setElenco(data || []);
  }
  useEffect(() => { carica(); }, []);

  if (aperta) return <Editor campagna={aperta} regioni={regioni} onChiudi={() => { setAperta(null); carica(); }} />;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <p style={{ fontSize: 13, color: C.grafite, margin: 0, maxWidth: 680 }}>
          Ogni campagna ha il suo testo, la sua grafica e i suoi destinatari. Le email partono solo agli indirizzi generici (mai alle PEC) degli enti scelti, con il collegamento «Approfondisci» alla pagina di simulazione e quello per non ricevere altre comunicazioni.
        </p>
        <button onClick={() => setAperta(vuota())} style={btnPrimario}>+ Nuova campagna</button>
      </div>
      {errore && <div style={{ color: C.red, fontSize: 13 }}>{errore}</div>}
      {elenco.length === 0 && <div style={{ fontSize: 13, color: C.grafite }}>Nessuna campagna.</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {elenco.map((c) => (
          <button key={c.id} onClick={() => setAperta(c)} style={{ textAlign: "left", background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 14 }}>{c.titolo}</b>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.stato === "inviata" ? C.green : c.stato === "in_invio" ? C.amber : C.grafite }}>{c.stato === "inviata" ? `Inviata il ${new Date(c.inviata_il).toLocaleDateString("it-IT")}` : c.stato === "in_invio" ? "In invio" : "Bozza"}</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.grafite }}>{c.oggetto}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Editor({ campagna, regioni, onChiudi }) {
  const [c, setC] = useState(campagna);
  const [esito, setEsito] = useState(null);
  const [stato, setStato] = useState(null);
  const [errori, setErrori] = useState([]);
  const [inCorso, setInCorso] = useState("");
  const [target, setTarget] = useState({ comuni: true, gestori: false, regioni: [], popMin: "", popMax: "", natura: "", raccolta: false, tariffa: false, ...(campagna.target || {}) });
  const [trovati, setTrovati] = useState(null); // { totale, conEmail, ids }
  const inviata = c.stato === "inviata";

  async function aggiornaStato(id = c.id) {
    if (!id) return;
    setStato(await statoInvii(id));
    const { data } = await ultimiErrori(id);
    setErrori(data || []);
  }
  useEffect(() => { aggiornaStato(); }, []);

  // Anteprima con un Comune di esempio.
  const anteprima = useMemo(() => htmlCampagna({ portale: window.location.origin, grafica: c.grafica, oggetto: c.oggetto, testo: c.testo, ente: "Comune di Esempio", token: "anteprima" }), [c.grafica, c.oggetto, c.testo]);

  async function salva() {
    const { data, error } = await salvaCampagna({ id: c.id, titolo: c.titolo.trim(), oggetto: c.oggetto.trim(), testo: c.testo, grafica: c.grafica, target });
    if (error) { setEsito({ errore: true, testo: error.message }); return null; }
    setC(data);
    setEsito({ testo: "Campagna salvata." });
    return data;
  }

  // Enti che rispettano i criteri (solo quelli con email entrano).
  async function cerca() {
    setInCorso("Ricerca dei destinatari…");
    const tipi = [target.comuni && "comune", target.gestori && "gestore"].filter(Boolean);
    let tutti = [];
    for (const tipo of tipi) {
      const { data, error } = await idEntiFiltrati({ tipo, regioni: target.regioni, popMin: tipo === "comune" ? target.popMin : "", popMax: tipo === "comune" ? target.popMax : "", natura: tipo === "gestore" ? target.natura : "", raccolta: tipo === "gestore" && target.raccolta, tariffa: tipo === "gestore" && target.tariffa });
      if (error) { setInCorso(""); setEsito({ errore: true, testo: error.message }); return; }
      tutti = tutti.concat(data);
    }
    setInCorso("");
    setTrovati({ totale: tutti.length, conEmail: tutti.filter((e) => e.email).length, ids: tutti.filter((e) => e.email).map((e) => e.id) });
  }

  async function aggiungi() {
    const salvata = await salva();
    if (!salvata) return;
    setInCorso("Preparazione degli invii…");
    let creati = 0, saltati = 0;
    for (let i = 0; i < trovati.ids.length; i += 2000) {
      const { data, error } = await preparaInvii(salvata.id, trovati.ids.slice(i, i + 2000));
      if (error) { setInCorso(""); setEsito({ errore: true, testo: error.message }); return; }
      creati += data?.[0]?.creati || 0;
      saltati += data?.[0]?.saltati || 0;
    }
    setInCorso("");
    setTrovati(null);
    setEsito({ testo: `${num(creati)} destinatari aggiunti${saltati ? `, ${num(saltati)} saltati (già presenti o disiscritti)` : ""}.` });
    aggiornaStato(salvata.id);
  }

  async function prova() {
    const salvata = await salva();
    if (!salvata) return;
    setInCorso("Invio della prova…");
    const { data, error } = await azioneMarketing("prova_campagna", { campagna: salvata.id });
    setInCorso("");
    setEsito(error || !data?.ok ? { errore: true, testo: `Prova non inviata: ${error?.message || data?.errore}` } : { testo: `Prova inviata a ${data.a}.` });
  }

  async function invia() {
    if (!window.confirm(`Inviare la campagna a ${num(stato?.daInviare)} destinatari? L'invio non si può annullare.`)) return;
    const salvata = await salva();
    if (!salvata) return;
    let inviati = 0, errori = 0;
    for (;;) {
      setInCorso(`Invio in corso: ${num(inviati)} inviate${errori ? `, ${num(errori)} errori` : ""}…`);
      const { data, error } = await azioneMarketing("invia_campagna", { campagna: salvata.id, quanti: 50 });
      if (error) { setEsito({ errore: true, testo: error.message }); break; }
      inviati += data.inviati; errori += data.errori;
      if (!data.restano || (data.inviati === 0 && data.errori === 0)) break;
    }
    setInCorso("");
    setEsito({ testo: `Invio terminato: ${num(inviati)} email inviate${errori ? `, ${num(errori)} con errore` : ""}.` });
    const { data: aggiornata } = await leggiCampagna(salvata.id);
    if (aggiornata) setC(aggiornata);
    aggiornaStato(salvata.id);
  }

  async function togliDaInviare() {
    if (!window.confirm("Togliere i destinatari non ancora inviati?")) return;
    const { error } = await togliInviiDaInviare(c.id);
    setEsito(error ? { errore: true, testo: error.message } : { testo: "Destinatari non inviati tolti." });
    aggiornaStato();
  }
  async function elimina() {
    if (!window.confirm("Eliminare questa campagna in bozza?")) return;
    const { error } = await eliminaCampagna(c.id);
    if (error) setEsito({ errore: true, testo: error.message }); else onChiudi();
  }

  const casella = (chiave, etichetta) => (
    <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
      <input type="checkbox" checked={!!target[chiave]} onChange={(e) => setTarget({ ...target, [chiave]: e.target.checked })} disabled={inviata} /> {etichetta}
    </label>
  );

  return (
    <div>
      <button onClick={onChiudi} style={{ ...btnMini, marginBottom: 10 }}>← Tutte le campagne</button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16 }}>
        {/* Testo e grafica */}
        <section style={sezione}>
          <h3 style={h3}>Messaggio</h3>
          <label style={lbl}>Titolo (interno)<input value={c.titolo} onChange={(e) => setC({ ...c, titolo: e.target.value })} style={campo} disabled={inviata} /></label>
          <label style={lbl}>Oggetto dell'email<input value={c.oggetto} onChange={(e) => setC({ ...c, oggetto: e.target.value })} style={campo} disabled={inviata} /></label>
          <label style={lbl}>Testo (paragrafi separati da una riga vuota; sotto il testo l'email aggiunge il riquadro «7, 10 o 21 anni» e il pulsante «Approfondisci»)
            <textarea rows={14} value={c.testo} onChange={(e) => setC({ ...c, testo: e.target.value })} style={{ ...campo, resize: "vertical", lineHeight: 1.45 }} disabled={inviata} />
          </label>
          <div style={{ ...lbl, marginBottom: 6 }}>Grafica dell'intestazione</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {Object.entries(GRAFICHE_CAMPAGNA).map(([k, g]) => (
              <button key={k} onClick={() => !inviata && setC({ ...c, grafica: k })} aria-pressed={c.grafica === k} style={{ padding: 4, borderRadius: 10, border: `2px solid ${c.grafica === k ? C.green : C.line}`, background: C.white, cursor: inviata ? "default" : "pointer" }}>
                <img src={`/marketing/${g.file}`} alt={g.nome} style={{ width: "100%", display: "block", borderRadius: 6 }} />
                <div style={{ fontSize: 12, padding: "4px 0 2px" }}>{g.nome}</div>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {!inviata && <button onClick={salva} style={btnPrimario}>Salva</button>}
            <button onClick={prova} style={btnMini} disabled={!!inCorso}>Invia una prova a me</button>
            {c.id && c.stato === "bozza" && <button onClick={elimina} style={{ ...btnMini, color: C.red }}>Elimina</button>}
          </div>
        </section>

        {/* Anteprima */}
        <section style={sezione}>
          <h3 style={h3}>Anteprima</h3>
          <iframe title="Anteprima dell'email" srcDoc={anteprima} sandbox="" style={{ width: "100%", height: 640, border: `1px solid ${C.line}`, borderRadius: 10, background: C.paper }} />
        </section>
      </div>

      {/* Destinatari e invio */}
      <section style={{ ...sezione, marginTop: 16 }}>
        <h3 style={h3}>Destinatari</h3>
        {stato && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
            {[["Destinatari", stato.totale], ["Da inviare", stato.daInviare], ["Inviate", stato.inviati], ["Errori", stato.errori], ["Escluse", stato.esclusi], ["Visite", stato.visite], ["Simulazioni", stato.simulazioni], ["Richieste", stato.richieste]].map(([k, v]) => (
              <div key={k} style={{ background: C.paper, borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontFamily: "'Archivo'", fontSize: 20, fontWeight: 800, color: k === "Errori" && v ? C.red : C.ink }}>{num(v)}</div>
                <div style={{ fontSize: 11.5, color: C.grafite }}>{k}</div>
              </div>
            ))}
          </div>
        )}
        {errori.length > 0 && (
          <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>
            Ultimi errori: {errori.map((e) => `${e.email}: ${e.errore}`).join(" · ")}
            {errori.some((e) => /domain|verify|testing|own email/i.test(e.errore || "")) && " — Resend consegna solo all'indirizzo del titolare finché il dominio del mittente non è verificato (EMAIL_MITTENTE)."}
          </div>
        )}
        {!inviata && (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              {casella("comuni", "Comuni")}
              {casella("gestori", "Gestori")}
              {target.comuni && (
                <>
                  <input value={target.popMin} onChange={(e) => setTarget({ ...target, popMin: e.target.value })} placeholder="Abitanti da" inputMode="numeric" style={{ ...campo, width: 110 }} aria-label="Abitanti da" />
                  <input value={target.popMax} onChange={(e) => setTarget({ ...target, popMax: e.target.value })} placeholder="a" inputMode="numeric" style={{ ...campo, width: 90 }} aria-label="Abitanti fino a" />
                </>
              )}
              {target.gestori && (
                <>
                  <select value={target.natura} onChange={(e) => setTarget({ ...target, natura: e.target.value })} style={campo} aria-label="Natura dei gestori">
                    <option value="">Gestori pubblici e privati</option><option value="pubblico">Solo pubblici</option><option value="privato">Solo privati</option><option value="misto">Solo misti</option>
                  </select>
                  {casella("raccolta", "che fanno raccolta per Comuni")}
                  {casella("tariffa", "che gestiscono la tariffa")}
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 4 }}>Regioni (nessuna scelta = tutta Italia)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginBottom: 10 }}>
              {regioni.map((r) => (
                <label key={r} style={{ fontSize: 12.5, display: "flex", gap: 4, alignItems: "center" }}>
                  <input type="checkbox" checked={target.regioni.includes(r)} onChange={(e) => setTarget({ ...target, regioni: e.target.checked ? [...target.regioni, r] : target.regioni.filter((x) => x !== r) })} /> {r}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={cerca} style={btnMini} disabled={!!inCorso || (!target.comuni && !target.gestori)}>Cerca i destinatari</button>
              {trovati && (
                <>
                  <span style={{ fontSize: 13 }}>{num(trovati.totale)} enti trovati, <b>{num(trovati.conEmail)}</b> con email generica.</span>
                  {trovati.conEmail > 0 && <button onClick={aggiungi} style={btnPrimario} disabled={!!inCorso}>Aggiungi {num(trovati.conEmail)} destinatari</button>}
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {stato?.daInviare > 0 && <button onClick={invia} style={btnPrimario} disabled={!!inCorso}>Invia la campagna a {num(stato.daInviare)} destinatari</button>}
              {stato?.daInviare > 0 && <button onClick={togliDaInviare} style={btnMini} disabled={!!inCorso}>Togli i destinatari non inviati</button>}
            </div>
          </>
        )}
        {(inCorso || esito) && <div style={{ marginTop: 10, fontSize: 13, color: inCorso ? C.grafite : esito?.errore ? C.red : C.green }}>{inCorso || esito.testo}</div>}
      </section>
    </div>
  );
}

const sezione = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, minWidth: 0 };
const h3 = { fontFamily: "'Archivo'", fontSize: 15, margin: "0 0 10px" };
const lbl = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 10 };
