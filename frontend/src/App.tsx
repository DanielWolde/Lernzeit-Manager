// App.tsx
// Zeigt je nach Login-Status die Login-Seite oder die Hauptseite.

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "./services/firebase";
import LoginPage from "./LoginPage";
import Home from "./Home";

export default function App() {
  // undefined = Ladezustand, null = ausgeloggt, User = eingeloggt
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    // Firebase-Listener: wird bei jedem Auth-Statuswechsel aufgerufen
    // Rückgabewert ist die Unsubscribe-Funktion → React ruft sie beim Unmount auf
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (user === undefined) return null; // Auth-Status lädt noch – nichts zeigen
  if (!user) return <LoginPage />;     // Kein User → Login
  return <Home user={user} />;         // User vorhanden → Hauptseite
}
