/* =========================================================================
   UtentiOnline — presenza degli utenti e pannello «Utenti online»
   Scopo (richiesta di Luca del 19/10/2026, backlog 38):
     - SegnalaPresenza: per ogni utente collegato, mentre una pagina
       riservata è aperta e visibile, dice al database «sono qui, su questa
       pagina» all'apertura della pagina, quando la scheda torna visibile e
       una volta al minuto (RPC segnala_presenza, script 32). Non mostra nulla.
     - IndicatoreOnline: solo per l'Amministratore principale
       (luca.moretti@operate.it, script 29), un pulsante nell'intestazione
       con il numero degli utenti online; apre un pannello con chi è
       collegato adesso (pagina aperta, da quanto) e chi è stato visto nelle
       ultime 24 ore.
   Online = ultima segnalazione da meno di 2 minuti (lo calcola il database).
   Usato da: src/components/Header.jsx.
   Dati: segnalaPresenza, elencaUtentiOnline, idAmministratorePrincipale
     (src/lib/dati.js); nomi delle pagine e durate da src/lib/presenza.js. «Esci» cancella la presenza (AuthContext.esci).
   Sicurezza: il controllo vero è nel database: la tabella presenza non è
     leggibile dal browser e utenti_online() risponde solo all'Amministratore
     principale. Qui il pulsante si nasconde soltanto agli altri. Si
     conservano solo ora, pagina e inizio del collegamento: niente IP,
     niente storico.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»; script 32.
   ========================================================================= */
import React, { useEffect, useRef, useState } from "react";
import { COLORI as C, RUOLI } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import { elencaUtentiOnline, idAmministratorePrincipale, segnalaPresenza } from "../lib/dati.js";
import { durata, nomePagina } from "../lib/presenza.js";

// Ora italiana (hh:mm) di un istante; con il giorno se non è oggi.
function ora(iso) {
  const d = new Date(iso);
  const opz = { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" };
  const oggi = new Date().toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  const giorno = d.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });
  return giorno === oggi ? d.toLocaleTimeString("it-IT", opz) : `${giorno.slice(0, 5)} ${d.toLocaleTimeString("it-IT", opz)}`;
}

/* Segnale di presenza: nessuna interfaccia. Props: pagina (indirizzo
   corrente). Gli errori si ignorano: non deve mai disturbare il lavoro. */
export function SegnalaPresenza({ pagina }) {
  useEffect(() => {
    function segnala() {
      if (document.visibilityState === "visible") segnalaPresenza(pagina).catch(() => {});
    }
    segnala();
    const t = setInterval(segnala, 60000);
    document.addEventListener("visibilitychange", segnala);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", segnala);
    };
  }, [pagina]);
  return null;
}

// Chi è l'Amministratore principale: si chiede una volta sola per sessione
// del browser (la risposta non cambia mentre si naviga).
let principaleInMemoria = null;

/* Pulsante «n online» e pannello. Nessuna prop: legge utente e ruolo da
   useAuth(). Non mostra nulla a chi non è l'Amministratore principale. */
export function IndicatoreOnline() {
  const { utente, ruolo } = useAuth();
  const [principale, setPrincipale] = useState(principaleInMemoria);
  const [righe, setRighe] = useState([]);
  const [aperto, setAperto] = useState(false);
  const [pos, setPos] = useState(null);
  const box = useRef(null);

  // Chiede al database chi è l'Amministratore principale (solo agli Admin).
  useEffect(() => {
    if (ruolo !== "admin" || principaleInMemoria) return;
    idAmministratorePrincipale().then(({ data }) => {
      if (data) {
        principaleInMemoria = String(data);
        setPrincipale(principaleInMemoria);
      }
    });
  }, [ruolo]);

  const sonoPrincipale = ruolo === "admin" && utente && principale === utente.id;

  // Elenco aggiornato ogni 30 secondi (solo per l'Amministratore principale).
  useEffect(() => {
    if (!sonoPrincipale) return undefined;
    async function carica() {
      const { data, error } = await elencaUtentiOnline();
      if (!error) setRighe(data || []);
    }
    carica();
    const t = setInterval(carica, 30000);
    return () => clearInterval(t);
  }, [sonoPrincipale]);

  // Posizione del pannello sotto il pulsante, sempre dentro la finestra
  // (come la tendina delle notifiche).
  function calcolaPosizione() {
    if (!box.current) return;
    const r = box.current.getBoundingClientRect();
    const margine = 16;
    const larghezza = Math.min(420, window.innerWidth - 2 * margine);
    const sinistra = Math.max(margine, Math.min(r.right - larghezza, window.innerWidth - larghezza - margine));
    setPos({ top: r.bottom + 8, left: sinistra, width: larghezza });
  }
  useEffect(() => {
    if (!aperto) return undefined;
    calcolaPosizione();
    window.addEventListener("resize", calcolaPosizione);
    window.addEventListener("scroll", calcolaPosizione, true);
    return () => {
      window.removeEventListener("resize", calcolaPosizione);
      window.removeEventListener("scroll", calcolaPosizione, true);
    };
  }, [aperto]);

  // Chiude il pannello cliccando fuori.
  useEffect(() => {
    function fuori(e) {
      if (box.current && !box.current.contains(e.target)) setAperto(false);
    }
    document.addEventListener("mousedown", fuori);
    return () => document.removeEventListener("mousedown", fuori);
  }, []);

  if (!sonoPrincipale) return null;
  const online = righe.filter((r) => r.online);
  const recenti = righe.filter((r) => !r.online);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button
        onClick={() => setAperto((a) => !a)}
        aria-expanded={aperto}
        aria-label={`Utenti online: ${online.length}`}
        title="Utenti collegati adesso"
        style={{
          display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 10px",
          background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, cursor: "pointer",
          fontSize: 12.5, fontWeight: 600, color: C.grafite, whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: online.length ? "#2fb24c" : "#b9bdb3", boxShadow: online.length ? "0 0 0 3px rgba(47,178,76,0.18)" : "none" }} />
        {online.length} online
      </button>

      {aperto && pos && (
        <div
          role="dialog"
          aria-label="Utenti online"
          style={{
            position: "fixed", top: pos.top, left: pos.left, width: pos.width,
            maxHeight: `min(480px, calc(100vh - ${Math.round(pos.top) + 16}px))`, overflowY: "auto",
            background: C.white, border: `1px solid ${C.line}`, borderRadius: 12,
            boxShadow: "0 12px 32px rgba(27,33,24,0.14)", zIndex: 40,
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.line}` }}>
            <b style={{ fontSize: 13.5 }}>Utenti online adesso: {online.length}</b>
            <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 2 }}>Visibile solo all'Amministratore principale · si aggiorna ogni 30 secondi</div>
          </div>
          {online.length === 0 && <div style={{ padding: "14px", fontSize: 13, color: C.grafite }}>Nessuno è collegato in questo momento.</div>}
          {online.map((r) => <RigaUtente key={r.id} r={r} online />)}
          {recenti.length > 0 && (
            <>
              <div style={{ padding: "10px 14px 6px", fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.grafite, background: C.paper, borderTop: `1px solid ${C.line}` }}>
                Visti nelle ultime 24 ore
              </div>
              {recenti.map((r) => <RigaUtente key={r.id} r={r} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* Una riga del pannello. Props: r (riga di utenti_online), online. */
function RigaUtente({ r, online }) {
  const ruolo = RUOLI[r.ruolo];
  return (
    <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.line}`, display: "grid", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: online ? "#2fb24c" : "#b9bdb3", flex: "none" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome_completo || r.email}</span>
        {ruolo && <span style={{ fontSize: 10.5, fontWeight: 600, color: ruolo.color, background: ruolo.soft, padding: "2px 8px", borderRadius: 999 }}>{ruolo.short}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: C.grafite, paddingLeft: 15, overflowWrap: "anywhere" }}>
        {r.nome_completo ? `${r.email} · ` : ""}
        {r.organizzazione ? `${r.organizzazione} · ` : ""}
        {online ? `su «${nomePagina(r.pagina)}» · collegato da ${durata(r.collegato_dal)}` : `ultimo accesso alle ${ora(r.visto_il)}`}
      </div>
    </div>
  );
}
