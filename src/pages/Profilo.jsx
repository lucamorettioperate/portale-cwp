/* =========================================================================
   Il mio profilo — indirizzo «/profilo»
   Scopo: mostra i dati dell'account (nome, email di accesso, ruolo), il
     collegamento al cambio password («/password») e i documenti da
     scaricare per il proprio ruolo: Manuale Utente per tutti; Manuale
     Amministratore e Registro sviluppo e deploy solo per gli Amministratori.
   Chi la usa: tutti gli utenti con accesso (cliente, operatore, admin).
   Dati: nessuna lettura propria; usa utente/profilo/ruolo da
     src/lib/AuthContext.jsx e l'elenco documenti ElencoDocumenti di
     Documentazione.jsx (file statici in public/).
   Sicurezza: la scelta dei documenti per ruolo è solo interfaccia (i file
     sono statici: vedi Documentazione.jsx).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React from "react";
import { Link } from "react-router-dom";
import { COLORI as C, RUOLI } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import { ElencoDocumenti } from "./Documentazione.jsx";

/* Pagina del profilo. Nessuna prop, nessun salvataggio diretto. */
export default function Profilo() {
  const { utente, profilo, ruolo } = useAuth();
  const r = RUOLI[ruolo];
  // Alla creazione il nome può essere stato impostato uguale all'email
  // (trigger on_auth_user_created): in quel caso la riga «Nome» non compare.
  const nome = profilo?.nome_completo && !profilo.nome_completo.includes("@") ? profilo.nome_completo : null;

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 16px" }}>Il mio profilo</h1>

        <section style={riquadro}>
          <h2 style={h2}>Account</h2>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 8, fontSize: 14 }}>
            {nome && (<><span style={etichetta}>Nome</span><span>{nome}</span></>)}
            <span style={etichetta}>Email di accesso</span><span>{utente?.email}</span>
            <span style={etichetta}>Ruolo</span><span>{r ? r.label : "—"}</span>
          </div>
        </section>

        <section style={riquadro}>
          <h2 style={h2}>Password</h2>
          <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 12px" }}>
            Per sicurezza usa una password che non adoperi per altri servizi e cambiala se pensi che altri la conoscano.
          </p>
          <Link to="/password" style={pulsante}>Cambia password</Link>
        </section>

        <section style={{ ...riquadro, background: "transparent", border: "none", padding: 0 }}>
          <h2 style={{ ...h2, margin: "6px 0 10px" }}>{ruolo === "admin" ? "Manuali e documentazione" : "Manuale"}</h2>
          <ElencoDocumenti compatto />
        </section>
      </main>
    </div>
  );
}

// Stili della pagina.
const riquadro = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 };
const h2 = { fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 12px" };
const etichetta = { color: C.grafite, fontSize: 13 };
const pulsante = { display: "inline-block", background: C.green, color: C.white, textDecoration: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700 };
