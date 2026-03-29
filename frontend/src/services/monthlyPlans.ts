// monthlyPlans.ts
// Monatliche Lernpläne in Firestore speichern und laden (Sammlung: "monthlyPlans").

import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  doc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

// Ein monatlicher Lernplan
export type MonthlyPlan = {
  id: string;
  userId: string;
  month: string;       // Format: "YYYY-MM"
  plannedHours: number;
};

// Interner Firestore-Typ (ohne id)
type MonthlyPlanDoc = {
  userId: string;
  month: string;
  plannedHours: number;
};

// Firestore-Dokument in ein MonthlyPlan-Objekt umwandeln
function toMonthlyPlan(id: string, data: DocumentData): MonthlyPlan {
  const d = data as Partial<MonthlyPlanDoc>;
  return {
    id,
    userId: String(d.userId ?? ""),
    month: String(d.month ?? ""),
    plannedHours: Number(d.plannedHours ?? 0),
  };
}

// Monat als "YYYY-MM"-String berechnen, um eine bestimmte Anzahl Monate versetzt
function addMonths(yyyyMm: string, plus: number) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  dt.setMonth(dt.getMonth() + plus);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

// Alle Monatspläne des Nutzers laden, aufsteigend nach Monat sortiert
export async function loadMonthlyPlans(userId: string): Promise<MonthlyPlan[]> {
  const q = query(collection(db, "monthlyPlans"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const all = snap.docs.map((d) => toMonthlyPlan(d.id, d.data()));
  all.sort((a, b) => a.month.localeCompare(b.month)); // Alphabetisch = chronologisch
  return all;
}

// Plan für einen bestimmten Monat aus einer Liste zurückgeben
export function getPlanForMonth(plans: MonthlyPlan[], month: string): MonthlyPlan | null {
  return plans.find((p) => p.month === month) ?? null;
}

// Plan für einen Monat speichern – wird aktualisiert falls er schon existiert
export async function saveMonthlyPlan(
  userId: string,
  month: string,
  plannedHours: number
): Promise<void> {
  const plans = await loadMonthlyPlans(userId);
  const existing = plans.find((p) => p.month === month);

  if (existing) {
    // Plan existiert → nur Stunden aktualisieren
    await updateDoc(doc(db, "monthlyPlans", existing.id), {
      plannedHours,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // Plan existiert noch nicht → neu anlegen
  await addDoc(collection(db, "monthlyPlans"), {
    userId,
    month,
    plannedHours,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// 6 Monate ab einem Startmonat anlegen – alle Schreiboperationen laufen parallel
export async function createSixMonthPlan(
  userId: string,
  startMonth: string,
  hoursPerMonth: number
): Promise<void> {
  // Die 6 Monate ab startMonth berechnen
  const months = Array.from({ length: 6 }, (_, i) => addMonths(startMonth, i));

  // Bestehende Pläne einmal laden (1 Firestore-Read)
  const existingPlans = await loadMonthlyPlans(userId);

  // Alle 6 Writes gleichzeitig ausführen (Promise.all = parallel)
  await Promise.all(
    months.map((m) => {
      const existing = existingPlans.find((p) => p.month === m);
      if (existing) {
        // Plan vorhanden → aktualisieren
        return updateDoc(doc(db, "monthlyPlans", existing.id), {
          plannedHours: hoursPerMonth,
          updatedAt: serverTimestamp(),
        });
      }
      // Plan nicht vorhanden → neu anlegen
      return addDoc(collection(db, "monthlyPlans"), {
        userId,
        month: m,
        plannedHours: hoursPerMonth,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    })
  );
}
