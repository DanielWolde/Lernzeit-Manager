// styles.ts
// Wiederverwendbare Inline-Style-Objekte für die gesamte App.
// Wird in Home.tsx und LoginPage.tsx als `s` importiert.

import type { CSSProperties } from "react";

export const s: Record<string, CSSProperties> = {
  // Vollbild-Seitenhintergrund (hellgrau)
  page: {
    minHeight: "100vh",
    background: "#f6f7fb",
    padding: 24,
    display: "grid",
    placeItems: "center",
  },

  // Zentrierter Content-Bereich, max. 1440 px breit
  shell: {
    width: "100%",
    maxWidth: 1440,
    display: "grid",
    gap: 16,
  },

  // Weiße Karte mit Schatten und abgerundeten Ecken
  card: {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
    padding: 18,
    display: "grid",
    gap: 12,
  },

  // Große Überschrift
  h1: { margin: 0, fontSize: 18, fontWeight: 900 },

  // Kleinere Abschnitts-Überschrift
  h2: { margin: 0, fontSize: 16, fontWeight: 900 },

  // Gedimmter Hilfstext
  muted: { fontSize: 13, opacity: 0.7 },

  // Flex-Zeile mit Umbruch und Abstand
  row: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },

  // Einheitliches Eingabefeld
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    outline: "none",
    fontSize: 14,
    background: "#fff",
    boxSizing: "border-box",
  },

  // Primär-Button (schwarz)
  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    width: "auto",
  },

  // Sekundär-Button (weiß mit Rahmen)
  btnGhost: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    width: "auto",
  },

  // Roter Button für Lösch-Aktionen
  btnDanger: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#e53935",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    width: "auto",
  },

  // Kleines Label (z.B. Kategorie-Tag)
  pill: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fafafa",
    fontSize: 13,
  },

  // Gelbe Warnmeldungs-Box
  warn: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "#fff3cd",
    border: "1px solid #ffeeba",
    color: "#6b4e00",
    fontSize: 14,
  },

  // Äußerer Rahmen des Fortschrittsbalkens
  progressOuter: {
    height: 10,
    borderRadius: 999,
    background: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  },

  // Horizontale Trennlinie zwischen Abschnitten
  divider: {
    height: 1,
    background: "rgba(0,0,0,0.08)",
    margin: "4px 0",
  },
};
