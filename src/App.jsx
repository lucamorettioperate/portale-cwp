import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import BackOffice from "./pages/BackOffice.jsx";
import { COLORI as C } from "./lib/cwpProgram.js";

// Schermata di caricamento mentre si verifica la sessione.
function Caricamento() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: C.grafite }}>
      Caricamento…
    </div>
  );
}

// Protegge le pagine: senza sessione rimanda al login.
function Protetta({ children }) {
  const { autenticato, caricamento, backendPronto } = useAuth();
  if (caricamento) return <Caricamento />;
  // Se il backend non è configurato, mostra comunque la dashboard (anteprima dati esempio).
  if (!backendPronto) return children;
  if (!autenticato) return <Navigate to="/login" replace />;
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
            <BackOffice />
          </Protetta>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
