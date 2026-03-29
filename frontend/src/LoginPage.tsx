// LoginPage.tsx
// Anmelde- und Registrierungsformular mit E-Mail und Passwort.

import { type CSSProperties, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./services/firebase";
import { s } from "./styles";

// Übersetzt Firebase-Fehlermeldungen ins Deutsche
function translateAuthError(message: string): string {
  if (
    message.includes("invalid-credential") ||
    message.includes("wrong-password") ||
    message.includes("user-not-found")
  )
    return "E-Mail oder Passwort ist falsch.";
  if (message.includes("email-already-in-use"))
    return "Diese E-Mail-Adresse ist bereits registriert.";
  if (message.includes("invalid-email"))
    return "Bitte gib eine gültige E-Mail-Adresse ein.";
  if (message.includes("weak-password"))
    return "Das Passwort ist zu schwach (mindestens 6 Zeichen).";
  if (message.includes("too-many-requests"))
    return "Zu viele Versuche. Bitte warte einen Moment.";
  return "Ein Fehler ist aufgetreten. Bitte versuche es erneut.";
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLogin = mode === "login";
  // Submit nur möglich wenn nicht am laden und beide Felder ausgefüllt
  const canSubmit = !loading && email.trim() !== "" && password.trim() !== "";

  // Wechselt zwischen Login und Registrierung, setzt Fehler zurück
  function switchMode() {
    setMode(isLogin ? "register" : "login");
    setError(null);
  }

  // Sendet das Formular an Firebase
  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      // Bei Erfolg: App.tsx erkennt den neuen Auth-State automatisch
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setError(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Header: App-Name und Titel */}
        <div style={{ display: "grid", gap: 6 }}>
          <div style={brandStyle}>LERNZEIT-MANAGER</div>
          <h1 style={{ margin: 0, fontSize: 22 }}>
            {isLogin ? "Anmelden" : "Registrieren"}
          </h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>
            {isLogin
              ? "Melde dich an, um Lernziele und Lernzeiten zu verwalten."
              : "Erstelle einen Account, um loszulegen."}
          </p>
        </div>

        {/* Eingabefelder */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>E-Mail</label>
            <input
              style={s.input}
              type="email"
              value={email}
              placeholder="name@beispiel.de"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} // Enter → Submit
              autoComplete="email"
              autoFocus // Fokus direkt auf E-Mail-Feld beim Laden
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>Passwort</label>
            <input
              style={s.input}
              type="password"
              value={password}
              placeholder="Mindestens 6 Zeichen"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} // Enter → Submit
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>
        </div>

        {/* Fehlermeldung (nur sichtbar wenn error gesetzt) */}
        {error && <div style={errorBoxStyle}>{error}</div>}

        {/* Primär-Button: Login oder Registrierung */}
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{ ...s.btn, width: "100%", opacity: canSubmit ? 1 : 0.55 }}
        >
          {loading ? "Bitte warten…" : isLogin ? "Einloggen" : "Account erstellen"}
        </button>

        {/* Modus-Wechsel-Button */}
        <button onClick={switchMode} style={{ ...s.btnGhost, width: "100%" }}>
          {isLogin
            ? "Noch keinen Account? Registrieren"
            : "Schon registriert? Login"}
        </button>
      </div>
    </div>
  );
}

/* ===================== LOCAL STYLES ===================== */

// Vollbild-Hintergrund, zentriert die Login-Karte
const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "#f6f7fb",
};

// Login-Karte
const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  borderRadius: 18,
  padding: 24,
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
  display: "grid",
  gap: 14,
};

// App-Name oben links
const brandStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: 1,
  opacity: 0.6,
  fontWeight: 700,
};

// Rote Fehlerbox unter den Eingabefeldern
const errorBoxStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  background: "rgba(220, 20, 60, 0.08)",
  border: "1px solid rgba(220, 20, 60, 0.20)",
  color: "#b00020",
  fontSize: 13,
};
