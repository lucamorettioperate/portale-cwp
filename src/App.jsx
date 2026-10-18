/* =========================================================================
   App.jsx — mappa degli indirizzi (rotte) del portale.

   Scopo: associa ogni indirizzo alla sua pagina e decide chi può aprirla.
   Le pagine riservate passano dal componente Protetta, che nell'ordine
   chiede: sessione attiva, eventuale nuova password (link di recupero o
   password temporanea), verifica MFA per lo staff. Le pagine pubbliche
   (consultazioni, formato dati, reimposta password) non richiedono accesso.

   Usato da: src/main.jsx.
   Dati/servizi coinvolti: nessuna chiamata diretta; legge lo stato da
   useAuth() (src/lib/AuthContext.jsx).

   Sicurezza: questi controlli servono all'esperienza d'uso (cosa mostrare).
   Il controllo del ruolo per le pagine Admin (/utenti, /audit, /crediti,
   /impostazioni) è fatto anche dentro le pagine e, soprattutto, dal
   database con RLS e funzioni: una rotta aperta per errore non espone dati.

   Per aggiungere una pagina: importarla qui, aggiungere la <Route> e
   aggiornare la tabella «Pagine» del Registro.

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)», tabella Pagine.
   ========================================================================= */
import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./lib/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import BackOffice from "./pages/BackOffice.jsx";
import AreaCliente from "./pages/AreaCliente.jsx";
import GestioneUtenti from "./pages/GestioneUtenti.jsx";
import Cruscotto from "./pages/Cruscotto.jsx";
import TuoiDocumenti from "./pages/TuoiDocumenti.jsx";
import Audit from "./pages/Audit.jsx";
import VerificaMfa from "./pages/VerificaMfa.jsx";
import Crediti from "./pages/Crediti.jsx";
import CalcoloCrediti from "./pages/CalcoloCrediti.jsx";
import Impostazioni from "./pages/Impostazioni.jsx";
import { ElencoConsultazioni, PaginaConsultazione, ConfermaOsservazione } from "./pages/ConsultazioniPubbliche.jsx";
import FormatoDati from "./pages/FormatoDati.jsx";
import Documentazione from "./pages/Documentazione.jsx";
import CambiaPassword from "./pages/CambiaPassword.jsx";
import Profilo from "./pages/Profilo.jsx";
import { COLORI as C } from "./lib/cwpProgram.js";

// Schermata di caricamento mentre si verifica la sessione.
function Caricamento() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: C.grafite }}>
      Caricamento…
    </div>
  );
}

// Sceglie la pagina giusta in base al ruolo dell'utente.
function HomePerRuolo() {
  const { ruolo } = useAuth();
  if (ruolo === "operatore" || ruolo === "admin") return <Cruscotto />;
  // Default: vista cliente (anche se il profilo non ha ancora un ruolo definito).
  return <AreaCliente />;
}

// Protegge le pagine: senza sessione rimanda al login.
// Parametri: children = la pagina da mostrare se tutti i controlli passano.
// L'ordine dei controlli conta: recupero e password temporanea vengono prima
// della MFA, così l'utente non resta bloccato con una password da cambiare.
function Protetta({ children }) {
  const { autenticato, caricamento, backendPronto, mfa, passwordDaCambiare, recupero } = useAuth();
  const location = useLocation();
  if (caricamento) return <Caricamento />;
  // Senza Supabase configurato (sviluppo locale senza .env) non c'è login:
  // le pagine si aprono direttamente.
  if (!backendPronto) return children;
  // Senza sessione: al login, ricordando la pagina richiesta (es. link di un'email).
  if (!autenticato) return <Navigate to="/login" replace state={{ da: location }} />;
  // Arrivato da un link "password dimenticata": prima la nuova password.
  if (recupero) return <Navigate to="/reimposta-password" replace />;
  // Password temporanea: va cambiata prima di tutto il resto.
  if (passwordDaCambiare) return <CambiaPassword modo="obbligatorio" />;
  // Operatori e Amministratori: prima la verifica a due fattori.
  if (mfa.richiesta && !mfa.verificata) return <VerificaMfa />;
  return children;
}

// Dopo l'accesso torna alla pagina richiesta (es. una pratica aperta da un'email).
// La pagina richiesta arriva in location.state.da, impostata da Protetta;
// si riusano solo percorso e query, quindi si resta sempre dentro il portale.
function PaginaLogin({ autenticato }) {
  const location = useLocation();
  if (!autenticato) return <Login />;
  const da = location.state?.da;
  const destinazione = da ? `${da.pathname || "/"}${da.search || ""}` : "/";
  return <Navigate to={destinazione} replace />;
}

// Componente principale: elenco delle rotte. Un indirizzo sconosciuto
// rimanda alla pagina iniziale "/".
export default function App() {
  const { autenticato, caricamento } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={caricamento ? <Caricamento /> : <PaginaLogin autenticato={autenticato} />} />
      {/* Arrivo dal link dell'email "password dimenticata" (pagina pubblica) */}
      <Route path="/reimposta-password" element={<CambiaPassword modo="recupero" />} />
      <Route
        path="/profilo"
        element={
          <Protetta>
            <Profilo />
          </Protetta>
        }
      />
      <Route
        path="/password"
        element={
          <Protetta>
            <CambiaPassword modo="volontario" />
          </Protetta>
        }
      />
      {/* Pagina pubblica, senza login: formato dei dati per Comuni e gestori */}
      <Route path="/formato-dati" element={<FormatoDati />} />
      {/* Consultazioni pubbliche: senza accesso (script 17, funzione consultazione-pubblica) */}
      <Route path="/consultazioni" element={<ElencoConsultazioni />} />
      <Route path="/consultazioni/conferma" element={<ConfermaOsservazione />} />
      <Route path="/consultazioni/:id" element={<PaginaConsultazione />} />
      {/* Da qui in poi: pagine riservate. Le pagine solo Admin (/audit,
          /crediti, /impostazioni, /utenti) controllano anche il ruolo al loro interno. */}
      <Route
        path="/"
        element={
          <Protetta>
            <HomePerRuolo />
          </Protetta>
        }
      />
      <Route
        path="/pratiche"
        element={
          <Protetta>
            <BackOffice />
          </Protetta>
        }
      />
      <Route
        path="/documenti"
        element={
          <Protetta>
            <TuoiDocumenti />
          </Protetta>
        }
      />
      <Route
        path="/audit"
        element={
          <Protetta>
            <Audit />
          </Protetta>
        }
      />
      <Route
        path="/crediti"
        element={
          <Protetta>
            <Crediti />
          </Protetta>
        }
      />
      <Route
        path="/crediti/:id"
        element={
          <Protetta>
            <CalcoloCrediti />
          </Protetta>
        }
      />
      <Route
        path="/impostazioni"
        element={
          <Protetta>
            <Impostazioni />
          </Protetta>
        }
      />
      <Route
        path="/documentazione"
        element={
          <Protetta>
            <Documentazione />
          </Protetta>
        }
      />
      <Route
        path="/utenti"
        element={
          <Protetta>
            <GestioneUtenti />
          </Protetta>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
