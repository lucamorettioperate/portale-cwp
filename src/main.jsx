/* =========================================================================
   main.jsx — punto di ingresso del portale (React + Vite).

   Scopo: monta l'applicazione nell'elemento #root di index.html e la avvolge
   nei contesti globali: StrictMode (controlli di React in sviluppo),
   BrowserRouter (indirizzi /pratiche, /crediti, …) e AuthProvider
   (sessione, ruolo, MFA). Carica anche il foglio di stile globale.

   Usato da: index.html (<script type="module" src="/src/main.jsx">).
   Dati/servizi coinvolti: nessuno direttamente; Supabase è raggiunto
   tramite AuthProvider (src/lib/AuthContext.jsx).
   Nota: gli indirizzi del router funzionano anche ricaricando la pagina
   grazie alla regola di riscrittura in vercel.json.

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)».
   ========================================================================= */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./lib/AuthContext.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
