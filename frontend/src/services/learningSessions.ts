// learningSessions.ts
// Lernsessions in Firestore speichern und laden (Sammlung: "learningSessions").

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Eine abgeschlossene Lerneinheit
export type LearningSession = {
  id: string;
  durationSeconds: number; // Gesamtdauer in Sekunden
  startedAt: Timestamp;
  endedAt: Timestamp;
  category?: string; // Optionales Thema, z.B. "Mathe", "Programmierung"
};

// Abgeschlossene Lernsession speichern – Dauer wird aus Start- und Endzeit berechnet
export async function saveSession(
  userId: string,
  startedAt: Date,
  endedAt: Date,
  category?: string
): Promise<void> {
  // Dauer aus Zeitstempeln berechnen
  const durationSeconds = Math.floor(
    (endedAt.getTime() - startedAt.getTime()) / 1000
  );

  await addDoc(collection(db, "learningSessions"), {
    userId,
    startedAt: Timestamp.fromDate(startedAt),
    endedAt: Timestamp.fromDate(endedAt),
    durationSeconds,
    category: category?.trim() || null, // Leerer String → null speichern
    createdAt: serverTimestamp(),
  });
}

// Session dauerhaft löschen
export async function deleteSession(sessionId: string): Promise<void> {
  await deleteDoc(doc(db, "learningSessions", sessionId));
}

// Alle Sessions des Nutzers laden
export async function loadSessions(userId: string): Promise<LearningSession[]> {
  const q = query(
    collection(db, "learningSessions"),
    where("userId", "==", userId)
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      durationSeconds: data.durationSeconds,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      // null aus Firestore wird zu undefined – konsistenter Typ nach außen
      category: typeof data.category === "string" ? data.category : undefined,
    };
  });
}
