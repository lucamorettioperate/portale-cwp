/* =========================================================================
   Documentazione (Manuale) — indirizzo «/documentazione»
   Scopo: elenco dei documenti del portale da aprire in PDF o scaricare in
     Word, ciascuno con la revisione più recente e la sua data.
     - Manuale Utente: per tutti i ruoli (in PDF; il Word solo agli
       Amministratori).
     - Manuale Amministratore, Manuale Test, Registro sviluppo e deploy,
       Istruzioni di ripristino e la Presentazione di riepilogo (PDF e
       PowerPoint, strumenti/presentazione/genera_presentazione.cjs): solo
       Amministratori.
     - Per gli Amministratori, in fondo, gli 8 documenti ufficiali del
       Programma Carbon WastePrint® v1.2 (Guida, Definizioni, Normativa,
       Standard, Metodologia, Politica di reclamo, Schema tariffario,
       Gestione della qualità dei dati): sono i modelli di categoria
       «programma» (script 25), letti con elencaModelli e aperti con un
       indirizzo firmato temporaneo (urlModelloApri / urlModello).
     Il titolo della pagina è «Documentazione» per l'Admin, «Manuale» per
     gli altri. L'elenco (ElencoDocumenti) è riusato in «Il mio profilo».
   Chi la usa: tutti gli utenti con accesso; il contenuto dipende dal ruolo.
   Dati: nessuna lettura dal database. I file stanno in public/manuali e
     public/documentazione e sono generati da strumenti/genera_documenti.cjs;
     revisione e data arrivano dallo stesso registro delle revisioni
     (strumenti/revisioni_documenti.json, incluso nella build). Per
     aggiungere una revisione: aggiornare il JSON e rigenerare i file.
   Sicurezza: il filtro per ruolo è SOLO interfaccia. I file in public/
     sono statici e raggiungibili da chiunque conosca l'indirizzo, anche
     senza accesso: non metterci informazioni riservate (credenziali,
     chiavi, dati personali).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import REVISIONI from "../../strumenti/revisioni_documenti.json";
import { elencaModelli, urlModello, urlModelloApri } from "../lib/dati.js";

/* Catalogo dei documenti.
   - chiave: voce corrispondente in revisioni_documenti.json
   - percorso: indirizzo del file SENZA estensione (si aggiungono .pdf e .docx)
   - soloAdmin: se vero il documento compare solo agli Amministratori
   - secondo: formato del secondo pulsante (predefinito Word, .docx). */
const DOCUMENTI = [
  {
    chiave: "manuale",
    titolo: "Manuale Utente",
    descrizione: "Guida passo per passo al portale per Comuni, enti e soggetti gestori: accesso, pratiche e fasi, documenti, integrazioni, consultazione pubblica, notifiche, tracciato dati.",
    percorso: "/manuali/Manuale_Utente_Portale_CWP",
    soloAdmin: false,
  },
  {
    chiave: "amministratore",
    titolo: "Manuale Amministratore",
    descrizione: "Funzioni della Fondazione passo per passo: dashboard, pratiche e fasi, documenti, integrazioni, consultazione, pagamenti, utenti, audit, impostazioni e calcolo dei crediti CWP. Documento riservato agli Amministratori.",
    percorso: "/documentazione/Manuale_Amministratore_Portale_CWP",
    soloAdmin: true,
  },
  {
    chiave: "test",
    titolo: "Manuale Test",
    descrizione: "Guida sintetica per chi collauda il portale: il metodo CWP, il ruolo del portale e un percorso di prova dall'adesione del Comune al calcolo dei crediti, con i risultati attesi. Documento riservato agli Amministratori.",
    percorso: "/documentazione/Manuale_Test_Portale_CWP",
    soloAdmin: true,
  },
  {
    chiave: "registro",
    titolo: "Registro sviluppo e deploy",
    descrizione: "Architettura, servizi e configurazione, database, funzionalità, procedure di rilascio, cronologia degli sviluppi, artefatti, decisioni e backlog. Documento riservato agli Amministratori.",
    percorso: "/documentazione/Registro_Dev_Deploy_Portale_CWP",
    soloAdmin: true,
  },
  {
    chiave: "ripristino",
    titolo: "Istruzioni di ripristino",
    descrizione: "Dove stanno codice e dati, quali copie di sicurezza fare e come rimettere in funzione GitHub, Vercel, Supabase, Resend e il progetto Claude se qualcosa va perso. Documento riservato agli Amministratori.",
    percorso: "/documentazione/Istruzioni_Ripristino_Portale_CWP",
    soloAdmin: true,
  },
  {
    chiave: "presentazione",
    titolo: "Presentazione di riepilogo",
    descrizione: "Recap del portale in slide: metodologia, funzioni, novità, architettura e ruoli, punti aperti, simulatore, piani a pagamento e scelte da prendere. Aggiornata a ogni rilascio. Documento riservato agli Amministratori.",
    percorso: "/documentazione/Presentazione_Portale_CWP",
    soloAdmin: true,
    secondo: { estensione: "pptx", etichetta: "Scarica PowerPoint" },
  },
];

/* Elenco dei documenti scaricabili per il ruolo (usato anche in "Il mio profilo").
   Prop `compatto`: versione ridotta senza descrizione e nota di revisione.
   Il pulsante «Scarica Word» compare solo agli Amministratori. */
export function ElencoDocumenti({ compatto = false }) {
  const { ruolo } = useAuth();
  const admin = ruolo === "admin";
  const visibili = DOCUMENTI.filter((d) => admin || !d.soloAdmin);
  return (
    <div style={{ display: "grid", gap: compatto ? 10 : 14 }}>
      {visibili.map((d) => {
        // Le revisioni nel JSON sono in ordine cronologico: vale l'ultima.
        const revisioni = REVISIONI[d.chiave] || [];
        const rev = revisioni[revisioni.length - 1];
        return (
          <section key={d.chiave} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: compatto ? "14px 16px" : "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "'Archivo'", fontSize: compatto ? 15 : 17, margin: 0 }}>{d.titolo}</h2>
              {rev && (
                <span style={{ fontSize: 12, color: C.green, background: C.greenSoft, borderRadius: 999, padding: "2px 9px", fontWeight: 600 }}>
                  Rev. {rev.rev} · {rev.data}
                </span>
              )}
              {d.soloAdmin && (
                <span style={{ fontSize: 11.5, color: C.grafite, border: `1px solid ${C.line}`, borderRadius: 999, padding: "1px 8px" }}>solo Amministratori</span>
              )}
            </div>
            {!compatto && <p style={{ fontSize: 13.5, color: C.grafite, margin: "8px 0 12px", lineHeight: 1.5 }}>{d.descrizione}</p>}
            {!compatto && rev && <p style={{ fontSize: 12.5, color: C.grafite, margin: "0 0 12px" }}>Ultima revisione: {rev.descrizione}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: compatto ? 10 : 0 }}>
              <a href={`${d.percorso}.pdf`} target="_blank" rel="noreferrer" style={pulsante(true)}>Apri PDF</a>
              {admin && (
                <a href={`${d.percorso}.${d.secondo?.estensione || "docx"}`} download style={pulsante(false)}>
                  {d.secondo?.etichetta || "Scarica Word"}
                </a>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* Pagina «Documentazione». Nessuna prop: intestazione, testo introduttivo
   per ruolo ed ElencoDocumenti completo. */
export default function Documentazione() {
  const { ruolo } = useAuth();
  const admin = ruolo === "admin";

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>{/* Titolo come la voce di menu: «Manuali» per gli enti (dal 20/10), «Manuale» per gli Operatori. */}
          {admin ? "Documentazione" : ruolo === "cliente" ? "Manuali" : "Manuale"}</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 18px" }}>
          {admin
            ? "Documenti del portale da scaricare in Word o PDF. Sono aggiornati a ogni nuova funzione o rilascio: la revisione indica la versione."
            : "Il manuale del portale in PDF. È aggiornato a ogni nuova funzione: la revisione indica la versione."}
        </p>

        <ElencoDocumenti />
        {admin && <DocumentiProgramma />}
      </main>
    </div>
  );
}

/* Gli 8 documenti ufficiali del Programma (v1.2), solo per gli
   Amministratori. Nessuna prop. Ordinati come nella numerazione ufficiale
   (CWP_0 … CWP_7, dal nome del file). Se l'elenco è vuoto la sezione non
   compare. */
function DocumentiProgramma() {
  const [documenti, setDocumenti] = useState([]);
  useEffect(() => {
    elencaModelli().then(({ data }) =>
      setDocumenti((data || []).filter((m) => m.categoria === "programma").sort((a, b) => (a.storage_path || "").localeCompare(b.storage_path || "")))
    );
  }, []);
  if (!documenti.length) return null;
  // Apre il PDF in una nuova scheda oppure lo scarica (indirizzo firmato di 60 secondi).
  async function apri(m, scarica) {
    const finestra = scarica ? null : window.open("", "_blank");
    const { data } = scarica ? await urlModello(m.storage_path) : await urlModelloApri(m.storage_path);
    if (!data?.signedUrl) { if (finestra) finestra.close(); return; }
    if (finestra) finestra.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }
  return (
    <section style={{ marginTop: 26 }}>
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 18, margin: "0 0 4px" }}>Documenti ufficiali del Programma Carbon WastePrint®</h2>
      <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 12px" }}>
        Gli 8 documenti della versione 1.2 (04/09/2025), gli stessi pubblicati sulla pagina pubblica del Programma.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {documenti.map((m, i) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: C.white, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13.5 }}>{(m.storage_path.match(/CWP_(\d+)/) || [, i])[1]}. {m.titolo}</b>
              {m.descrizione && <div style={{ fontSize: 12, color: C.grafite, marginTop: 2 }}>{m.descrizione}</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => apri(m, false)} style={{ ...pulsante(true), cursor: "pointer", padding: "6px 12px", fontSize: 12.5 }}>Apri PDF</button>
              <button onClick={() => apri(m, true)} style={{ ...pulsante(false), cursor: "pointer", padding: "6px 12px", fontSize: 12.5 }}>Scarica</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Stile dei pulsanti-link: pieno (principale = true) oppure bordato.
const pulsante = (principale) => ({
  display: "inline-block",
  background: principale ? C.green : C.white,
  color: principale ? C.white : C.green,
  border: `1px solid ${C.green}`,
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
});
