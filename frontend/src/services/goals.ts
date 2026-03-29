// goals.ts
// Lernziele in Firestore speichern, laden und verwalten (Sammlung: "goals").

import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

/* ===================== TYPES ===================== */

export type GoalPriority = "low" | "medium" | "high";

export type Goal = {
  id: string;
  userId: string;

  title: string;
  isDone: boolean;

  category: string;
  priority: GoalPriority;
  dueDate: Timestamp | null;
  note: string;

  isArchived: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  archivedAt?: Timestamp | null;
};

// Felder beim Erstellen eines neuen Ziels
export type CreateGoalInput = {
  title: string;
  category?: string;
  priority?: GoalPriority;
  dueDate?: Date | null;
  note?: string;
};

/* ===================== HELPERS ===================== */

// Stellt sicher, dass priority immer einen gültigen Wert hat
function normalizePriority(p: unknown): GoalPriority {
  if (p === "low" || p === "medium" || p === "high") return p;
  return "medium"; // Fallback für ungültige oder fehlende Werte
}

// Firestore-Dokument in ein Goal-Objekt umwandeln
function toGoal(id: string, data: DocumentData, fallbackUserId: string): Goal {
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : fallbackUserId,

    title: typeof data.title === "string" ? data.title : "",
    isDone: Boolean(data.isDone),

    category: typeof data.category === "string" ? data.category : "",
    priority: normalizePriority(data.priority),
    dueDate: (data.dueDate as Timestamp | null) ?? null,
    note: typeof data.note === "string" ? data.note : "",

    isArchived: Boolean(data.isArchived),
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
    archivedAt: (data.archivedAt as Timestamp | null) ?? null,
  };
}

// Timestamp-Wert in Millisekunden zurückgeben (0 bei fehlendem Wert)
function tsMillis(t?: Timestamp | null) {
  if (!t) return 0;
  try {
    return t.toMillis();
  } catch {
    return 0;
  }
}

/* ===================== CRUD ===================== */

// Neues Lernziel anlegen
export async function createGoal(userId: string, input: CreateGoalInput): Promise<void> {
  const title = input.title.trim();
  if (!title) return; // Leere Titel ablehnen

  await addDoc(collection(db, "goals"), {
    userId,
    title,
    isDone: false,

    category: input.category?.trim() ?? "",
    priority: input.priority ?? "medium",
    dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
    note: input.note?.trim() ?? "",

    isArchived: false,
    archivedAt: null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Alle Ziele des Nutzers laden, lokal nach Änderungsdatum sortiert
export async function loadGoals(
  userId: string,
  opts?: { includeArchived?: boolean }
): Promise<Goal[]> {
  const includeArchived = opts?.includeArchived ?? false;

  // Nur ein where-Filter → kein Composite-Index erforderlich
  const q = query(collection(db, "goals"), where("userId", "==", userId));
  const snap = await getDocs(q);

  const all = snap.docs.map((d) => toGoal(d.id, d.data(), userId));

  // Lokale Sortierung: neueste zuerst
  all.sort((a, b) => {
    const am = tsMillis(a.updatedAt) || tsMillis(a.createdAt);
    const bm = tsMillis(b.updatedAt) || tsMillis(b.createdAt);
    return bm - am;
  });

  // Archivierte Ziele nur mitsenden wenn explizit angefragt
  return includeArchived ? all : all.filter((g) => !g.isArchived);
}

// Status eines Ziels auf erledigt oder offen setzen
export async function setGoalDone(goalId: string, done: boolean): Promise<void> {
  await updateDoc(doc(db, "goals", goalId), {
    isDone: done,
    updatedAt: serverTimestamp(),
  });
}

// Einzelne Felder eines Ziels aktualisieren
export async function updateGoal(
  goalId: string,
  patch: Partial<{
    title: string;
    category: string;
    priority: GoalPriority;
    dueDate: Date | null;
    note: string;
  }>
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };

  // Nur Felder schreiben die tatsächlich übergeben wurden
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.category !== undefined) update.category = patch.category.trim();
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.note !== undefined) update.note = patch.note.trim();
  if (patch.dueDate !== undefined) {
    update.dueDate = patch.dueDate ? Timestamp.fromDate(patch.dueDate) : null;
  }

  await updateDoc(doc(db, "goals", goalId), update);
}

// Ziel dauerhaft löschen
export async function deleteGoal(goalId: string): Promise<void> {
  await deleteDoc(doc(db, "goals", goalId));
}

// Ziel archivieren (bleibt in der Datenbank, wird aber ausgeblendet)
export async function archiveGoal(goalId: string): Promise<void> {
  await updateDoc(doc(db, "goals", goalId), {
    isArchived: true,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Archiviertes Ziel wiederherstellen
export async function restoreGoal(goalId: string): Promise<void> {
  await updateDoc(doc(db, "goals", goalId), {
    isArchived: false,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
}
