/* =========================================================================
   Cambia password — tre usi (src/App.jsx):
     «/password»            modo "volontario"   (pagina protetta)
     «/reimposta-password»  modo "recupero"     (pagina pubblica: arrivo dal
                                                 link dell'email di recupero)
     qualsiasi pagina protetta, modo "obbligatorio", finché il profilo ha
     ancora la password temporanea (Protetta in App.jsx la mostra al posto
     della pagina richiesta).
   Scopo: scegliere una nuova password, con le regole di src/lib/password.js.
     - "obbligatorio": primo accesso con password temporanea (o reimpostata
       dall'Amministratore): finché non la cambia l'utente non entra;
     - "volontario": l'utente cambia la propria password dal menu;
     - "recupero": l'utente arriva dal link dell'email «password dimenticata».
   Chi la usa: tutti i ruoli; il recupero anche senza accesso già fatto.
   Dati: cambiaPassword() di src/lib/AuthContext.jsx (Supabase Auth
     updateUser + RPC password_cambiata, script 15, che toglie l'obbligo e
     scrive l'audit); controllaPassword / traduciErroreAuth / REGOLE_PASSWORD
     di src/lib/password.js.
   Sicurezza: l'obbligo di cambio è imposto dall'interfaccia (App.jsx). Il
     database garantisce solo che l'utente non possa togliersi da solo il
     flag password_temporanea senza passare da password_cambiata() (trigger
     profilo_campi_protetti, script 15). Il link di recupero è validato da
     Supabase Auth.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import { controllaPassword, traduciErroreAuth, REGOLE_PASSWORD } from "../lib/password.js";

/* Modulo di cambio password.
   Prop `modo`: "volontario" (predefinito), "obbligatorio" o "recupero".
   Nei modi "obbligatorio" e "recupero" la pagina è a schermo intero senza
   intestazione; dopo il salvataggio porta a «/» dopo 1,5 secondi. */
export default function CambiaPassword({ modo = "volontario" }) {
  const { utente, cambiaPassword, esci, mfa, autenticato, caricamento } = useAuth();
  const navigate = useNavigate();
  const [attuale, setAttuale] = useState("");
  const [nuova, setNuova] = useState("");
  const [conferma, setConferma] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [fatto, setFatto] = useState(false);

  // Nel cambio volontario si chiede la password attuale; per lo staff con
  // verifica a due fattori già superata non serve (e farebbe ripetere la verifica).
  const chiediAttuale = modo === "volontario" && !mfa.richiesta;

  // Link di recupero scaduto o già usato: Supabase lo segnala nell'indirizzo.
  const linkNonValido = modo === "recupero" && /error_code=|error=/.test(window.location.hash + window.location.search);

  // Invio del modulo: controlla i campi, salva la nuova password e mostra
  // la conferma. Gli errori di Supabase sono tradotti in italiano.
  async function salva(e) {
    e.preventDefault();
    setErrore("");
    if (chiediAttuale && !attuale) return setErrore("Inserisci la password attuale.");
    // Almeno 10 caratteri con lettere e numeri, niente parte locale
    // dell'email, le due password devono coincidere (src/lib/password.js).
    const problema = controllaPassword(nuova, conferma, utente?.email || "");
    if (problema) return setErrore(problema);
    setInCorso(true);
    const { error } = await cambiaPassword(nuova, chiediAttuale ? attuale : null);
    setInCorso(false);
    if (error) return setErrore(traduciErroreAuth(error));
    setFatto(true);
    if (modo !== "volontario") setTimeout(() => navigate("/", { replace: true }), 1500);
  }

  // Titolo e sottotitolo del modulo per ciascun modo.
  const titoli = {
    obbligatorio: ["Scegli la tua password", "Hai effettuato l'accesso con una password temporanea. Per continuare scegline una personale, che conoscerai solo tu."],
    volontario: ["Cambia password", "Scegli una nuova password per accedere al portale."],
    recupero: ["Nuova password", "Scegli la nuova password per il tuo account."],
  };
  const [titolo, sottotitolo] = titoli[modo];

  // Riquadro centrato che contiene il modulo o i messaggi. Fuori dal modo
  // "volontario" occupa tutto lo schermo e mostra il logo.
  const scheda = (contenuto) => (
    <div style={{ minHeight: modo === "volontario" ? "auto" : "100vh", display: "grid", placeItems: "center", background: C.paper, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: C.white, border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 26px" }}>
        {modo !== "volontario" && (
          <img src="/loghi/carbonwasteprint.png" alt="Carbon WastePrint" style={{ height: 72, width: "auto", display: "block", marginBottom: 14 }} />
        )}
        {contenuto}
      </div>
    </div>
  );

  // Scelta del contenuto, in ordine: verifica del link in corso, link non
  // valido (o nessuna sessione di recupero), conferma, modulo.
  let corpo;
  if (modo === "recupero" && caricamento) {
    corpo = scheda(<div style={{ color: C.grafite, fontSize: 14 }}>Verifica del collegamento…</div>);
  } else if (modo === "recupero" && (linkNonValido || !autenticato)) {
    corpo = scheda(
      <>
        <h1 style={h1}>Collegamento non valido</h1>
        <p style={testo}>Il collegamento per reimpostare la password è scaduto o è già stato usato. Richiedine uno nuovo dalla pagina di accesso con «Password dimenticata?».</p>
        <Link to="/login" style={{ ...bottone, display: "inline-block", textDecoration: "none", width: "auto", padding: "10px 16px" }}>Vai all'accesso</Link>
      </>
    );
  } else if (fatto) {
    corpo = scheda(
      <>
        <h1 style={h1}>Password aggiornata</h1>
        <p style={testo}>{modo === "volontario" ? "Da ora accedi con la nuova password." : "Ti porto al portale…"}</p>
        {modo === "volontario" && <Link to="/" style={{ color: C.green, fontWeight: 600, fontSize: 14 }}>Torna al portale</Link>}
      </>
    );
  } else {
    corpo = scheda(
      <form onSubmit={salva}>
        <h1 style={h1}>{titolo}</h1>
        <p style={testo}>{sottotitolo}</p>
        {utente?.email && <p style={{ ...testo, marginTop: -6 }}>Account: <b>{utente.email}</b></p>}
        {chiediAttuale && (
          <label style={etichetta}>
            Password attuale
            <input type="password" value={attuale} onChange={(e) => setAttuale(e.target.value)} autoComplete="current-password" style={campo} />
          </label>
        )}
        <label style={etichetta}>
          Nuova password
          <input type="password" value={nuova} onChange={(e) => setNuova(e.target.value)} autoComplete="new-password" style={campo} />
        </label>
        <label style={etichetta}>
          Ripeti la nuova password
          <input type="password" value={conferma} onChange={(e) => setConferma(e.target.value)} autoComplete="new-password" style={campo} />
        </label>
        <p style={{ fontSize: 12, color: C.grafite, margin: "-4px 0 14px" }}>{REGOLE_PASSWORD}</p>
        {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{errore}</div>}
        <button type="submit" disabled={inCorso} style={{ ...bottone, opacity: inCorso ? 0.7 : 1 }}>
          {inCorso ? "Salvataggio…" : "Salva la password"}
        </button>
        {modo === "obbligatorio" && (
          <button type="button" onClick={() => esci()} style={{ background: "none", border: "none", color: C.grafite, fontSize: 13, marginTop: 12, cursor: "pointer" }}>
            Esci
          </button>
        )}
      </form>
    );
  }

  // Solo il cambio volontario sta dentro il portale, con l'intestazione.
  if (modo !== "volontario") return corpo;
  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <div style={{ paddingTop: 24 }}>{corpo}</div>
    </div>
  );
}

// Stili condivisi del modulo.
const h1 = { fontFamily: "'Archivo'", fontSize: 20, margin: "0 0 8px" };
const testo = { fontSize: 13.5, color: C.grafite, margin: "0 0 16px", lineHeight: 1.5 };
const etichetta = { display: "block", fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 14 };
const campo = { width: "100%", marginTop: 5, padding: "11px 12px", border: `1px solid ${C.line}`, borderRadius: 9, fontSize: 14, boxSizing: "border-box" };
const bottone = { width: "100%", background: C.green, color: C.white, border: "none", borderRadius: 9, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
