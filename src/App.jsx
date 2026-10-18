import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
  const { autenticato, caricamento, backendPronto, mfa } = useAuth();
  if (caricamento) return <Caricamento />;
  if (!backendPronto) return children;
  if (!autenticato) return <Navigate to="/login" replace />;
  // Operatori e Amministratori: prima la verifica a due fattori.
  if (mfa.richiesta && !mfa.verificata) return <VerificaMfa />;
  return children;
}

export default function App() {
  const { autenticato, caricamento } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={caricamento ? <Caricamento /> : autenticato ? <Navigate to="/" replace /> : <Login />}
      />
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
