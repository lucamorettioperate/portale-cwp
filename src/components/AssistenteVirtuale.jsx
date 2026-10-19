/* =========================================================================
   AssistenteVirtuale — chat con l'assistente del portale (Claude)
   Scopo: pulsante «Assistente» in basso a destra che apre una finestra di
     conversazione. Le domande vanno alla funzione del server «assistente»
     (supabase/functions/assistente), che risponde con Claude usando solo
     la base di conoscenza del portale (manuali e tariffe).
   Chi lo vede: per ora Amministratori e utenti degli enti (ruolo cliente);
     il controllo vero del ruolo lo fa la funzione del server.
   Dati: chiediAssistente() di src/lib/dati.js. La conversazione resta solo
     nella pagina (si perde ricaricando o con «Nuova conversazione»); il
     server non salva i testi, conta solo domande e token (script 31).
   Le risposte sono testo semplice con un minimo di formattazione
     (paragrafi, elenchi puntati e numerati, grassetto **…**), disegnata
     senza inserire HTML: nessun rischio di codice nella risposta.
   Usato da: src/components/Header.jsx (presente in tutte le pagine riservate).
   Registro sviluppo e deploy: capitolo «Portale (frontend)»; backlog 21.
   ========================================================================= */
import React, { useEffect, useRef, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { chiediAssistente } from "../lib/dati.js";

// Domande di esempio per iniziare, diverse per ruolo.
const ESEMPI = {
  cliente: ["Come carico un documento nella mia pratica?", "Cosa devo fare quando ricevo una richiesta di integrazione?", "Quanto costa la registrazione di un progetto?"],
  admin: ["Come creo un nuovo utente amministratore?", "Come funziona il calcolo dei crediti?", "Quali sono i costi del Caso 1 per un Comune di 20.000 abitanti?"],
};

/* Pulsante e finestra della chat. Props: ruolo («admin» o «cliente»). */
export default function AssistenteVirtuale({ ruolo }) {
  const [aperto, setAperto] = useState(false);
  // Messaggi: [{ ruolo: "utente" | "assistente", testo, errore? }]
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState("");
  const [attesa, setAttesa] = useState(false);
  const [uso, setUso] = useState(null); // { domande_oggi, limite }
  const fondo = useRef(null);

  // Scorre in fondo a ogni nuovo messaggio.
  useEffect(() => {
    fondo.current?.scrollIntoView({ block: "end" });
  }, [messaggi, attesa, aperto]);

  // Invia la domanda con gli ultimi messaggi della conversazione (senza
  // quelli d'errore) e aggiunge la risposta.
  async function invia(domanda) {
    const q = (domanda ?? testo).trim();
    if (!q || attesa) return;
    const nuovi = [...messaggi, { ruolo: "utente", testo: q }];
    setMessaggi(nuovi);
    setTesto("");
    setAttesa(true);
    const { data, error } = await chiediAssistente(nuovi.filter((m) => !m.errore).slice(-12).map(({ ruolo: r, testo: t }) => ({ ruolo: r, testo: t })));
    setAttesa(false);
    if (error) setMessaggi((m) => [...m, { ruolo: "assistente", testo: error.message, errore: true }]);
    else {
      setMessaggi((m) => [...m, { ruolo: "assistente", testo: data.testo }]);
      if (data.limite) setUso({ domande_oggi: data.domande_oggi, limite: data.limite });
    }
  }

  return (
    <>
      {!aperto && (
        <button onClick={() => setAperto(true)} style={pulsanteApri} aria-label="Apri l'assistente virtuale" className="no-stampa">
          <span aria-hidden="true" style={{ fontSize: 16 }}>✦</span> Assistente
        </button>
      )}
      {aperto && (
        <div role="dialog" aria-label="Assistente virtuale" style={finestra} className="no-stampa">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.green, color: C.white }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Assistente virtuale</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>Risponde sul portale e sul Programma, dai manuali</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {messaggi.length > 0 && (
                <button onClick={() => { setMessaggi([]); setTesto(""); }} style={pulsanteTesta} title="Nuova conversazione">Nuova</button>
              )}
              <button onClick={() => setAperto(false)} style={pulsanteTesta} aria-label="Chiudi l'assistente">✕</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "grid", gap: 10, alignContent: "start", background: C.paper }}>
            {messaggi.length === 0 && (
              <div style={{ fontSize: 13, color: C.grafite, lineHeight: 1.5 }}>
                Ciao! Posso aiutarti a usare il portale: come si fa un'operazione, cosa significa una fase, quanto costa una voce del
                Programma. Non vedo i dati delle tue pratiche. Prova con una domanda:
                <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                  {(ESEMPI[ruolo] || ESEMPI.cliente).map((e) => (
                    <button key={e} onClick={() => invia(e)} style={esempio}>{e}</button>
                  ))}
                </div>
              </div>
            )}
            {messaggi.map((m, i) => (
              <div key={i} style={m.ruolo === "utente" ? bollaUtente : { ...bollaAssistente, ...(m.errore ? { background: "#fbeeea", color: C.red } : {}) }}>
                {m.ruolo === "utente" ? m.testo : <TestoRisposta testo={m.testo} />}
              </div>
            ))}
            {attesa && <div style={{ ...bollaAssistente, color: C.grafite }}>Un attimo…</div>}
            <div ref={fondo} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); invia(); }} style={{ borderTop: `1px solid ${C.line}`, padding: 10, background: C.white }}>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); invia(); } }}
                placeholder="Scrivi la tua domanda…"
                rows={2}
                maxLength={2000}
                aria-label="Domanda per l'assistente"
                style={{ flex: 1, resize: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "'Inter', sans-serif" }}
              />
              <button type="submit" disabled={attesa || !testo.trim()} style={{ ...pulsanteInvia, opacity: attesa || !testo.trim() ? 0.6 : 1 }}>Invia</button>
            </div>
            <div style={{ fontSize: 10.5, color: C.grafite, marginTop: 6 }}>
              Risposte generate da un'intelligenza artificiale (Claude): possono contenere errori, verifica nel manuale.
              {uso && ` Domande di oggi: ${uso.domande_oggi}/${uso.limite}.`}
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/* Risposta con formattazione minima: righe vuote = paragrafi; righe che
   iniziano con «- », «* » o «1. » = elenchi; **testo** = grassetto.
   Props: testo. Nessun HTML inserito: solo elementi React. */
function TestoRisposta({ testo }) {
  const blocchi = [];
  let elenco = null;
  for (const riga of String(testo).split("\n")) {
    const puntato = /^\s*[-*•]\s+(.*)/.exec(riga);
    const numerato = /^\s*(\d+)[.)]\s+(.*)/.exec(riga);
    if (puntato || numerato) {
      const tipo = puntato ? "ul" : "ol";
      if (!elenco || elenco.tipo !== tipo) { elenco = { tipo, voci: [] }; blocchi.push(elenco); }
      elenco.voci.push(puntato ? puntato[1] : numerato[2]);
    } else if (riga.trim() === "") {
      elenco = null;
    } else {
      elenco = null;
      const ultimo = blocchi[blocchi.length - 1];
      const testoRiga = riga.replace(/^#+\s*/, "");
      if (ultimo && ultimo.tipo === "p" && !ultimo.chiuso) ultimo.righe.push(testoRiga);
      else blocchi.push({ tipo: "p", righe: [testoRiga] });
    }
    if (riga.trim() === "" && blocchi.length && blocchi[blocchi.length - 1].tipo === "p") blocchi[blocchi.length - 1].chiuso = true;
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {blocchi.map((b, i) =>
        b.tipo === "p" ? (
          <p key={i} style={{ margin: 0 }}>{b.righe.map((r, j) => <React.Fragment key={j}>{j > 0 && <br />}{grassetto(r)}</React.Fragment>)}</p>
        ) : React.createElement(
          b.tipo,
          { key: i, style: { margin: 0, paddingLeft: 18, display: "grid", gap: 3 } },
          b.voci.map((v, j) => <li key={j}>{grassetto(v)}</li>)
        )
      )}
    </div>
  );
}

// **testo** in grassetto e *testo* in corsivo (Claude a volte usa il
// corsivo per i nomi dei ruoli o dei pulsanti); il resto come testo
// semplice. Un asterisco isolato (per esempio «2 * 3») resta com'è.
function grassetto(s) {
  return String(s)
    .split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*?\*)/g)
    .map((p, i) => {
      if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (p.length > 2 && p.startsWith("*") && p.endsWith("*") && !p.startsWith("**")) return <em key={i}>{p.slice(1, -1)}</em>;
      return <React.Fragment key={i}>{p}</React.Fragment>;
    });
}

// Stili.
const pulsanteApri = {
  position: "fixed", right: 18, bottom: 18, zIndex: 60, display: "flex", alignItems: "center", gap: 8,
  background: C.green, color: C.white, border: "none", borderRadius: 999, padding: "11px 18px",
  fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(27,33,24,0.25)",
};
const finestra = {
  position: "fixed", right: 16, bottom: 16, zIndex: 60, width: "min(400px, calc(100vw - 32px))", height: "min(560px, calc(100vh - 32px))",
  display: "flex", flexDirection: "column", background: C.white, border: `1px solid ${C.line}`, borderRadius: 14,
  overflow: "hidden", boxShadow: "0 16px 40px rgba(27,33,24,0.22)",
};
const pulsanteTesta = { background: "rgba(255,255,255,0.15)", color: C.white, border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const pulsanteInvia = { background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const bollaUtente = { justifySelf: "end", maxWidth: "85%", background: C.green, color: C.white, borderRadius: "12px 12px 2px 12px", padding: "8px 11px", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" };
const bollaAssistente = { justifySelf: "start", maxWidth: "92%", background: C.white, color: C.ink, border: `1px solid ${C.line}`, borderRadius: "12px 12px 12px 2px", padding: "9px 12px", fontSize: 13, lineHeight: 1.5 };
const esempio = { textAlign: "left", background: C.white, border: `1px solid ${C.line}`, borderRadius: 9, padding: "8px 10px", fontSize: 12.5, color: C.green, cursor: "pointer" };
