/**
 * main.tsx
 * Einstiegspunkt der React-App.
 * Mountet <App /> in den DOM-Knoten #root und aktiviert den StrictMode.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css"; // Globale Basis-Styles laden
import App from "./App.tsx";

// App in #root rendern – StrictMode aktiviert zusätzliche Entwicklungswarnungen
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
