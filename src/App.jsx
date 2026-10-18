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
import FormatoDati from "./pages/FormatoDati.jsx";
import Documentazione from "./pages/Documentazione.jsx";
import CambiaPassword from "./pages/CambiaPassword.jsx";
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
function Protetta({ children }) {
  const { autenticato, caricamento, backendPronto, mfa, passwordDaCambiare, recupero } = useAuth();
  const location = useLocation();
  if (caricamento) return <Caricamento />;
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
function PaginaLogin({ autenticato }) {
  const location = useLocation();
  if (!autenticato) return <Login />;
  const da = location.state?.da;
  const destinazione = da ? `${da.pathname || "/"}${da.search || ""}` : "/";
  return <Navigate to={destinazione} replace />;
}

export default function App() {
  const { autenticato, caricamento } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={caricamento ? <Caricamento /> : <PaginaLogin autenticato={autenticato} />} />
      {/* Arrivo dal link dell'email "password dimenticata" (pagina pubblica) */}
      <Route path="/reimposta-password" element={<CambiaPassword modo="recupero" />} />
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
