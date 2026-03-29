// Home.tsx
// Hauptseite nach dem Login mit Timer, Lernzielen, Monatsplanung und Session-Verlauf.

import { type CSSProperties, useEffect, useMemo, useState, useCallback } from "react";
import { signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "./services/firebase";
import { createGoal, loadGoals, setGoalDone, deleteGoal, type Goal } from "./services/goals";
import { saveSession, loadSessions, deleteSession, type LearningSession } from "./services/learningSessions";
import {
  saveMonthlyPlan,
  loadMonthlyPlans,
  createSixMonthPlan,
  type MonthlyPlan,
} from "./services/monthlyPlans";
import { s } from "./styles";

/* ====== Helpers ====== */

// Zahl auf 2 Stellen auffüllen, z.B. 5 → "05"
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Datum als "YYYY-MM"-String formatieren
function yyyyMm(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

// Anfang des Tages (00:00 Uhr) als Date zurückgeben
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Minuten in eine lesbare Zeitangabe umwandeln, z.B. 90 → "1h 30m"
function fmtMin(min: number) {
  if (min === 0) return "0 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Datum als deutschen Kurzstring formatieren, z.B. "Mo., 27. Feb."
function fmtDate(d: Date) {
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
}

// Zahl auf einen Bereich begrenzen
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// Anzahl aufeinanderfolgender Lerntage berechnen (Streak)
function computeStreak(sessions: LearningSession[], nowMs: number): number {
  if (sessions.length === 0) return 0;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  // Set aller Tage (Mitternacht in ms) an denen gelernt wurde
  const learnedDays = new Set(
    sessions.map((sess) => startOfDay(sess.startedAt.toDate()).getTime())
  );

  const today = startOfDay(new Date(nowMs)).getTime();
  // Wenn heute noch nicht gelernt wurde, starten wir von gestern
  let checkMs = learnedDays.has(today) ? today : today - MS_PER_DAY;

  let streak = 0;
  while (learnedDays.has(checkMs)) {
    streak++;
    checkMs -= MS_PER_DAY;
  }
  return streak;
}

// localStorage-Schlüssel für die Timer-Startzeit
const TIMER_KEY = "lernzeit_timer_startedAt";

// Gibt true zurück wenn das Fenster schmaler als 768 px ist (Handy)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

/* ====== Sub-Components ====== */

// Horizontaler Fortschrittsbalken (0–100 %)
function Progress({ value, color = "#111" }: { value: number; color?: string }) {
  const pct = clamp(Math.round(value), 0, 100);
  return (
    <div style={s.progressOuter}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.4s ease" }} />
    </div>
  );
}

// Einzelne Kennzahl-Kachel in der Stats-Leiste
function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ ...statCardStyle, borderTop: `3px solid ${accent ?? "transparent"}` }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent ?? "#111", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// Balkendiagramm: geplante vs. gelernte Stunden pro Monat
function MonthChart({
  plans,
  learnedMap,
}: {
  plans: MonthlyPlan[];
  learnedMap: Record<string, number>;
}) {
  if (plans.length === 0) return null;

  // Höchsten Wert aller Monate als Referenz für die Balkenhöhe
  const maxH = Math.max(
    ...plans.map((p) => Math.max(p.plannedHours, learnedMap[p.month] ?? 0)),
    1 // Minimum 1 damit kein Division-by-Zero
  );

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 90 }}>
      {plans.slice(0, 6).map((p) => {
        const learned = learnedMap[p.month] ?? 0;
        const planH = (p.plannedHours / maxH) * 100;
        // Gelernt-Balken niemals höher als Geplant-Balken zeigen
        const learnH = Math.min((learned / maxH) * 100, planH);
        const label = p.month.slice(5); // "YYYY-MM" → "MM"
        return (
          <div key={p.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "100%", position: "relative", height: 64 }}>
              {/* Geplanter Balken (Hintergrund, grau) */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  width: "100%",
                  height: `${planH}%`,
                  background: "rgba(0,0,0,0.08)",
                  borderRadius: "4px 4px 0 0",
                }}
              />
              {/* Gelernter Balken (Vordergrund, blau) */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  width: "100%",
                  height: `${learnH}%`,
                  background: "#1565c0",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.4s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 10, opacity: 0.55, fontWeight: 700 }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ====== Home ====== */

export default function Home({ user }: { user: User }) {
  const isMobile = useIsMobile();

  // ── Firestore-Daten
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Timer-Zustand
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [seconds, setSeconds] = useState(0);         // Laufende Sekunden (für Anzeige)
  const [sessionTopic, setSessionTopic] = useState(""); // Optionales Thema der Session

  // ── Formular-Inputs
  const [newGoal, setNewGoal] = useState("");
  const [month, setMonth] = useState(() => yyyyMm(new Date())); // Standardmäßig aktueller Monat
  const [plannedHours, setPlannedHours] = useState<number>(10);
  const [hoursPerMonth, setHoursPerMonth] = useState<number>(10);

  // ── Laden-Funktionen (stabil durch useCallback)
  const refreshGoals = useCallback(async () => {
    setGoals(await loadGoals(user.uid));
  }, [user.uid]);

  const refreshSessions = useCallback(async () => {
    setSessions(await loadSessions(user.uid));
  }, [user.uid]);

  const refreshPlans = useCallback(async () => {
    setPlans(await loadMonthlyPlans(user.uid));
  }, [user.uid]);

  // ── Initialer Datenabruf: alle drei parallel laden
  useEffect(() => {
    setLoading(true);
    Promise.all([refreshGoals(), refreshSessions(), refreshPlans()])
      .catch(() => setError("Daten konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [refreshGoals, refreshSessions, refreshPlans]);

  // ── Timer aus localStorage wiederherstellen (z.B. nach Seiten-Reload)
  useEffect(() => {
    const saved = localStorage.getItem(TIMER_KEY);
    if (!saved) return;
    const start = new Date(saved);
    if (isNaN(start.getTime())) return; // Ungültiger Wert → ignorieren
    setStartedAt(start);
    setRunning(true);
  }, []);

  // ── Timer-Tick: Sekunden aus echter Startzeit berechnen (im Effect, nicht im Render)
  // visibilitychange → sofort neu berechnen wenn Tab wieder aktiv wird
  useEffect(() => {
    if (!running || !startedAt) return;
    const compute = () => Math.floor((Date.now() - startedAt.getTime()) / 1000);
    setSeconds(compute());
    const id = setInterval(() => setSeconds(compute()), 1000);
    const onVisible = () => { if (document.visibilityState === "visible") setSeconds(compute()); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running, startedAt]);

  // ── Wenn Monat geändert wird: plannedHours aus dem vorhandenen Plan befüllen
  useEffect(() => {
    const existing = plans.find((p) => p.month === month);
    setPlannedHours(existing?.plannedHours ?? 10);
  }, [month, plans]);

  // ── Berechnete Stats (über useEffect wegen Date.now() – React Compiler Purity-Regel)
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [inactiveDays, setInactiveDays] = useState<number | null>(null);
  const [weekDays, setWeekDays] = useState<{ label: string; date: number; minutes: number; isToday: boolean; isFuture: boolean }[]>([]);

  useEffect(() => {
    const now = Date.now();
    const today0 = startOfDay(new Date(now)).getTime();

    // Minuten heute: alle Sessions die heute begonnen haben
    const todaySec = sessions
      .filter((sess) => sess.startedAt.toDate().getTime() >= today0)
      .reduce((acc, sess) => acc + sess.durationSeconds, 0);
    setTodayMinutes(Math.round(todaySec / 60));

    // Minuten diese Woche: Montag dieser Woche als Startpunkt
    const d = new Date(now);
    const dow = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    const weekSec = sessions
      .filter((sess) => sess.startedAt.toDate().getTime() >= monday.getTime())
      .reduce((acc, sess) => acc + sess.durationSeconds, 0);
    setWeekMinutes(Math.round(weekSec / 60));

    // Streak berechnen
    setStreak(computeStreak(sessions, now));

    // Inaktivitäts-Tage: Tage seit der letzten Session
    if (sessions.length === 0) {
      setInactiveDays(null);
    } else {
      const last = sessions
        .map((sess) => sess.startedAt.toDate())
        .sort((a, b) => b.getTime() - a.getTime())[0];
      setInactiveDays(Math.floor((now - last.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Wochenübersicht: Minuten pro Tag (Mo–So)
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayStart = day.getTime();
      const dayEnd = dayStart + 86_400_000;
      const secs = sessions
        .filter((sess) => { const t = sess.startedAt.toDate().getTime(); return t >= dayStart && t < dayEnd; })
        .reduce((acc, sess) => acc + sess.durationSeconds, 0);
      return {
        label: day.toLocaleDateString("de-DE", { weekday: "short" }).slice(0, 2),
        date: day.getDate(),
        minutes: Math.round(secs / 60),
        isToday: startOfDay(new Date(now)).getTime() === dayStart,
        isFuture: dayStart > startOfDay(new Date(now)).getTime(),
      };
    });
    setWeekDays(days);
  }, [sessions]);

  // ── Ziele aufgeteilt in offen und erledigt
  const openGoals = useMemo(() => goals.filter((g) => !g.isDone), [goals]);
  const doneGoals = useMemo(() => goals.filter((g) => g.isDone), [goals]);
  const goalsProgress = useMemo(
    () => (goals.length === 0 ? 0 : (doneGoals.length / goals.length) * 100),
    [goals.length, doneGoals.length]
  );

  // ── Gelernte Stunden pro Monat als Lookup-Map (für Diagramm und Monatsdetail)
  const learnedHoursPerMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sess of sessions) {
      const key = yyyyMm(sess.startedAt.toDate());
      map[key] = (map[key] ?? 0) + sess.durationSeconds;
    }
    // Sekunden → Stunden (gerundet auf 1 Dezimalstelle)
    for (const key of Object.keys(map)) {
      map[key] = Math.round((map[key] / 3600) * 10) / 10;
    }
    return map;
  }, [sessions]);

  // ── Letzte 8 Sessions (für den Session-Verlauf)
  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => b.startedAt.toDate().getTime() - a.startedAt.toDate().getTime())
        .slice(0, 8),
    [sessions]
  );

  // ── Aktueller Monatsplan und Fortschritt
  const currentPlan = useMemo(() => plans.find((p) => p.month === month) ?? null, [plans, month]);
  const learnedInMonth = learnedHoursPerMonth[month] ?? 0;
  const monthPct = (currentPlan?.plannedHours ?? 0) > 0
    ? (learnedInMonth / (currentPlan?.plannedHours ?? 1)) * 100
    : 0;

  // ── Datum der letzten Session (für die Anzeige unter dem Timer)
  const lastSessionDate = useMemo(() => {
    if (sessions.length === 0) return null;
    return sessions
      .map((sess) => sess.startedAt.toDate())
      .sort((a, b) => b.getTime() - a.getTime())[0];
  }, [sessions]);

  // ── Aktionen

  // Neues Lernziel anlegen
  const addGoal = useCallback(async () => {
    const title = newGoal.trim();
    if (!title) return;
    try {
      await createGoal(user.uid, { title, category: "", priority: "medium", dueDate: null, note: "" });
      setNewGoal("");
      await refreshGoals();
    } catch {
      setError("Ziel konnte nicht gespeichert werden.");
    }
  }, [newGoal, user.uid, refreshGoals]);

  // Erledigtstatus eines Ziels umschalten
  const toggleGoal = useCallback(
    async (g: Goal) => {
      try {
        await setGoalDone(g.id, !g.isDone);
        await refreshGoals();
      } catch {
        setError("Zielstatus konnte nicht aktualisiert werden.");
      }
    },
    [refreshGoals]
  );

  // Ziel nach Bestätigung dauerhaft löschen
  const removeGoal = useCallback(
    async (g: Goal) => {
      if (!window.confirm(`Ziel „${g.title}" wirklich löschen?`)) return;
      try {
        await deleteGoal(g.id);
        await refreshGoals();
      } catch {
        setError("Ziel konnte nicht gelöscht werden.");
      }
    },
    [refreshGoals]
  );

  // Session nach Bestätigung dauerhaft löschen
  const removeSession = useCallback(
    async (sess: LearningSession) => {
      if (!window.confirm(`Session vom ${fmtDate(sess.startedAt.toDate())} wirklich löschen?`)) return;
      try {
        await deleteSession(sess.id);
        await refreshSessions();
      } catch {
        setError("Session konnte nicht gelöscht werden.");
      }
    },
    [refreshSessions]
  );

  // Timer starten und Startzeit in localStorage sichern
  const startTimer = useCallback(() => {
    const now = new Date();
    localStorage.setItem(TIMER_KEY, now.toISOString()); // Persistenz über Reload
    setStartedAt(now);
    setSeconds(0);
    setRunning(true);
  }, []);

  // Timer stoppen, Session speichern und Anzeige zurücksetzen
  const stopTimer = useCallback(async () => {
    if (!startedAt) return;
    const endedAt = new Date();
    setRunning(false);
    setStartedAt(null);
    setSeconds(0); // Anzeige auf 0:00 zurücksetzen
    localStorage.removeItem(TIMER_KEY); // Timer-Key entfernen
    try {
      await saveSession(user.uid, startedAt, endedAt, sessionTopic);
      setSessionTopic("");
      await refreshSessions();
    } catch {
      setError("Session konnte nicht gespeichert werden.");
    }
  }, [startedAt, user.uid, sessionTopic, refreshSessions]);

  // Monatsplan für den ausgewählten Monat speichern
  const saveMonthPlan = useCallback(async () => {
    if (!month || plannedHours <= 0) return;
    try {
      await saveMonthlyPlan(user.uid, month, plannedHours);
      await refreshPlans();
    } catch {
      setError("Plan konnte nicht gespeichert werden.");
    }
  }, [month, plannedHours, user.uid, refreshPlans]);

  // 6-Monats-Schnellplan anlegen
  const makeSixMonths = useCallback(async () => {
    if (!month || hoursPerMonth <= 0) return;
    try {
      await createSixMonthPlan(user.uid, month, hoursPerMonth);
      await refreshPlans();
    } catch {
      setError("6-Monats-Plan konnte nicht angelegt werden.");
    }
  }, [month, hoursPerMonth, user.uid, refreshPlans]);

  // Anzeigeformat: seconds-State wird im Effect aus startedAt berechnet (kein Date.now() im Render)
  const timerHours = Math.floor(seconds / 3600);
  const timerMins  = Math.floor((seconds % 3600) / 60);
  const timerSecs  = seconds % 60;
  const timerLabel = timerHours > 0
    ? `${timerHours}:${String(timerMins).padStart(2, "0")}:${String(timerSecs).padStart(2, "0")}`
    : `${timerMins}:${String(timerSecs).padStart(2, "0")}`;

  // Ladezustand: zentrierter Spinner-Text
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f7fb" }}>
        <div style={s.muted}>Daten werden geladen…</div>
      </div>
    );
  }

  return (
    <div style={{ ...s.page, padding: isMobile ? "12px 16px" : "24px 32px" }}>
      <div style={s.shell}>

        {/* ── Topbar: App-Name, User-Email und Logout ── */}
        <div style={{ ...topbarStyle, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.5, opacity: 0.45, fontWeight: 700 }}>LERNZEIT-MANAGER</div>
            <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2 }}>{user.email}</div>
          </div>
          <button style={s.btnDanger} onClick={() => signOut(auth)}>Logout</button>
        </div>

        {/* ── Fehler-Banner (schließbar) ── */}
        {error && (
          <div style={{ ...s.warn, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={closeBtnStyle}>×</button>
          </div>
        )}

        {/* ── Inaktivitäts-Banner (ab 7 Tagen ohne Session) ── */}
        {!error && inactiveDays !== null && inactiveDays >= 7 && (
          <div style={s.warn}>
            ⚠️ Zuletzt gelernt vor <b>{inactiveDays} Tagen</b>. Starte heute eine Session!
          </div>
        )}

        {/* ── Stats-Leiste: 4 Kacheln nebeneinander (2x2 auf Handy) ── */}
        <div style={{ ...statsRowStyle, gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)" }}>
          <StatCard
            label="Lern-Streak"
            value={streak > 0 ? `${streak} ${streak === 1 ? "Tag" : "Tage"} 🔥` : "Kein Streak"}
            accent={streak >= 3 ? "#e65100" : streak >= 1 ? "#f57c00" : undefined}
          />
          <StatCard
            label="Heute gelernt"
            value={fmtMin(todayMinutes)}
            accent={todayMinutes > 0 ? "#2e7d32" : undefined}
          />
          <StatCard
            label="Diese Woche"
            value={fmtMin(weekMinutes)}
            accent={weekMinutes > 30 ? "#1565c0" : undefined}
          />
          <StatCard
            label="Offene Ziele"
            value={`${openGoals.length} offen`}
            accent={openGoals.length > 0 ? "#6a1b9a" : undefined}
          />
        </div>

        {/* ── Wochenübersicht ── */}
        {weekDays.length > 0 && (
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={s.h2}>Wochenübersicht</h2>
              <div style={s.muted}>{fmtMin(weekMinutes)} diese Woche</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {weekDays.map((day) => {
                const maxMin = Math.max(...weekDays.map((d) => d.minutes), 1);
                const barPct = (day.minutes / maxMin) * 100;
                const barColor = day.isToday ? "#1565c0" : day.minutes > 0 ? "#90caf9" : "transparent";
                return (
                  <div key={day.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    {/* Balken */}
                    <div style={{ width: "100%", height: 64, display: "flex", alignItems: "flex-end" }}>
                      <div style={{
                        width: "100%",
                        height: `${day.isFuture ? 0 : Math.max(barPct, day.minutes > 0 ? 8 : 0)}%`,
                        background: barColor,
                        borderRadius: "4px 4px 0 0",
                        border: day.minutes === 0 && !day.isFuture ? "1px dashed rgba(0,0,0,0.12)" : "none",
                        transition: "height 0.4s ease",
                        minHeight: day.minutes > 0 ? 6 : 0,
                      }} />
                    </div>
                    {/* Minuten-Label */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: day.isToday ? "#1565c0" : "#111", opacity: day.isFuture ? 0.25 : 1 }}>
                      {day.minutes > 0 ? fmtMin(day.minutes) : "–"}
                    </div>
                    {/* Tages-Label */}
                    <div style={{
                      fontSize: 11, fontWeight: day.isToday ? 900 : 600,
                      color: day.isToday ? "#1565c0" : "#111",
                      opacity: day.isFuture ? 0.35 : 0.6,
                    }}>
                      {day.label}
                    </div>
                    {/* Punkt für heute */}
                    {day.isToday && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#1565c0" }} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Haupt-Grid: 3 Spalten Desktop, 1 Spalte Handy ── */}
        <div style={{ ...gridStyle, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 0.7fr" }}>

          {/* ═══ LINKS: Timer + Ziele ═══ */}
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>

            {/* Timer-Karte */}
            <div style={{ ...s.card, ...(running ? timerRunningStyle : {}) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 style={s.h1}>Lern-Timer</h1>
                {running && <span style={runningBadge}>● läuft</span>}
              </div>

              {/* Große Zeit-Anzeige */}
              <div style={{ ...timerDigits, fontSize: isMobile ? 40 : 56 }}>{timerLabel}</div>

              {/* Thema-Eingabe: nur sichtbar wenn Timer läuft */}
              {running && (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ ...s.muted, fontSize: 12 }}>Womit lernst du gerade? (optional)</div>
                  <input
                    style={s.input}
                    value={sessionTopic}
                    onChange={(e) => setSessionTopic(e.target.value)}
                    placeholder="z.B. Mathe, Programmierung, Vokabeln…"
                    autoFocus
                  />
                </div>
              )}

              <div style={s.row}>
                {!running ? (
                  <button style={s.btn} onClick={startTimer}>Session starten</button>
                ) : (
                  <button style={s.btnDanger} onClick={stopTimer}>Stop & speichern</button>
                )}
                <div style={s.muted}>
                  {lastSessionDate
                    ? `Letzte Session: ${fmtDate(lastSessionDate)}`
                    : "Noch keine Sessions"}
                </div>
              </div>

              {/* Hinweis: Timer überlebt Seiten-Reload */}
              {running && (
                <div style={{ fontSize: 11, opacity: 0.4 }}>
                  Zeit wird nach einem Reload wiederhergestellt.
                </div>
              )}
            </div>

            {/* Lernziele-Karte */}
            <div style={s.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={s.h2}>Lernziele</h2>
                <div style={s.muted}>{doneGoals.length} / {goals.length} erledigt</div>
              </div>
              {/* Fortschrittsbalken: Anteil erledigter Ziele */}
              <Progress value={goalsProgress} color="#6a1b9a" />

              {/* Neues Ziel hinzufügen */}
              <div style={s.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    style={s.input}
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addGoal()}
                    placeholder="Neues Ziel hinzufügen…"
                  />
                </div>
                <button style={s.btn} onClick={addGoal} disabled={newGoal.trim() === ""}>+</button>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {/* Leerer Zustand */}
                {openGoals.length === 0 && doneGoals.length === 0 && (
                  <div style={s.muted}>Noch keine Ziele. Füge dein erstes Lernziel hinzu!</div>
                )}

                {/* Offene Ziele */}
                {openGoals.map((g) => (
                  <div key={g.id} style={goalItemStyle}>
                    <button onClick={() => toggleGoal(g)} style={goalBtnOpen}>
                      <span>{g.title}</span>
                      <span style={{ opacity: 0.35, fontSize: 16, flexShrink: 0 }}>○</span>
                    </button>
                    {/* Löschen-Button (kleines ×) */}
                    <button onClick={() => removeGoal(g)} style={goalDeleteBtn} title="Ziel löschen">×</button>
                  </div>
                ))}

                {/* Erledigte Ziele (max. 5 anzeigen) */}
                {doneGoals.length > 0 && (
                  <>
                    <div style={{ ...s.muted, marginTop: 4 }}>Abgeschlossen</div>
                    {doneGoals.slice(0, 5).map((g) => (
                      <div key={g.id} style={goalItemStyle}>
                        <button onClick={() => toggleGoal(g)} style={goalBtnDone}>
                          <span style={{ textDecoration: "line-through", opacity: 0.5 }}>{g.title}</span>
                          <span style={{ color: "#2e7d32", fontSize: 14, flexShrink: 0 }}>✓</span>
                        </button>
                        <button onClick={() => removeGoal(g)} style={goalDeleteBtn} title="Ziel löschen">×</button>
                      </div>
                    ))}
                    {doneGoals.length > 5 && (
                      <div style={{ ...s.muted, paddingLeft: 4 }}>… {doneGoals.length - 5} weitere abgeschlossen</div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ═══ MITTE: Planung ═══ */}
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div style={s.card}>
              <h2 style={s.h2}>Planung</h2>

              {/* 1) Monatsdetail: Plan für einen einzelnen Monat */}
              <div style={sectionStyle}>
                <div style={sectionLabel}>Monatsdetail</div>

                {/* Monat auswählen */}
                <input
                  style={s.input}
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />

                {/* Kennzahlen für den Monat */}
                <div style={s.row}>
                  <div style={s.pill}>Geplant: <b>{currentPlan?.plannedHours ?? 0}h</b></div>
                  <div style={s.pill}>Gelernt: <b>{learnedInMonth}h</b></div>
                  {(currentPlan?.plannedHours ?? 0) > 0 && (
                    <div style={s.pill}>Fortschritt: <b>{Math.round(clamp(monthPct, 0, 100))}%</b></div>
                  )}
                </div>

                {/* Fortschrittsbalken nur wenn ein Plan existiert */}
                {(currentPlan?.plannedHours ?? 0) > 0 && (
                  <Progress value={monthPct} color="#1565c0" />
                )}

                {(currentPlan?.plannedHours ?? 0) === 0 && (
                  <div style={{ ...s.muted, fontSize: 12 }}>Noch kein Plan für diesen Monat. Stunden festlegen:</div>
                )}

                {/* Stunden-Input und Speichern */}
                <div style={s.row}>
                  <div style={{ flex: 1 }}>
                    <input
                      style={s.input}
                      type="number"
                      min={1}
                      value={plannedHours}
                      onChange={(e) => setPlannedHours(Number(e.target.value))}
                      onKeyDown={(e) => e.key === "Enter" && saveMonthPlan()}
                      placeholder="Geplante Stunden"
                    />
                  </div>
                  <button style={s.btnGhost} onClick={saveMonthPlan}>Speichern</button>
                </div>
              </div>

              <div style={s.divider} />

              {/* 2) 6-Monats-Überblick: Balkendiagramm + Monatsliste */}
              <div style={sectionStyle}>
                <div style={sectionLabel}>6-Monats-Überblick</div>

                {plans.length === 0 ? (
                  <div style={{ ...s.muted, fontSize: 13 }}>
                    Noch keine Pläne. Lege unten einen 6-Monats-Plan an.
                  </div>
                ) : (
                  <>
                    {/* Balkendiagramm */}
                    <MonthChart plans={plans.slice(0, 6)} learnedMap={learnedHoursPerMonth} />

                    {/* Legende */}
                    <div style={{ display: "flex", gap: 12, fontSize: 11, opacity: 0.55 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, background: "rgba(0,0,0,0.12)", borderRadius: 2, display: "inline-block" }} />
                        Geplant
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, background: "#1565c0", borderRadius: 2, display: "inline-block" }} />
                        Gelernt
                      </span>
                    </div>

                    {/* Klickbare Monatsliste – Klick setzt den ausgewählten Monat */}
                    <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                      {plans.slice(0, 6).map((p) => {
                        const learned = learnedHoursPerMonth[p.month] ?? 0;
                        const pct = p.plannedHours > 0 ? (learned / p.plannedHours) * 100 : 0;
                        const isCurrentMonth = p.month === month;
                        return (
                          <div
                            key={p.id}
                            onClick={() => setMonth(p.month)}
                            style={{
                              ...planRowStyle,
                              ...(isCurrentMonth ? planRowActiveStyle : {}),
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: isCurrentMonth ? 800 : 600, fontSize: 13 }}>{p.month}</span>
                              <span style={{ ...s.muted, fontSize: 12 }}>{learned}h / {p.plannedHours}h</span>
                            </div>
                            <Progress value={pct} color="#1565c0" />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div style={s.divider} />

              {/* 3) 6-Monats-Schnellplan: gleiche Stunden für 6 Monate in einem Schritt */}
              <div style={sectionStyle}>
                <div style={sectionLabel}>6-Monats-Schnellplan</div>
                <div style={{ ...s.muted, fontSize: 12 }}>
                  Gleiche Stundenzahl für 6 Monate ab dem oben gewählten Monat anlegen.
                </div>
                <div style={s.row}>
                  <div style={{ flex: 1 }}>
                    <input
                      style={s.input}
                      type="number"
                      min={1}
                      value={hoursPerMonth}
                      onChange={(e) => setHoursPerMonth(Number(e.target.value))}
                      onKeyDown={(e) => e.key === "Enter" && makeSixMonths()}
                      placeholder="Stunden pro Monat"
                    />
                  </div>
                  <button style={s.btn} onClick={makeSixMonths}>Anlegen</button>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ RECHTS: Session-Verlauf ═══ */}
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div style={s.card}>
              <h2 style={s.h2}>Session-Verlauf</h2>
              {recentSessions.length === 0 ? (
                <div style={s.muted}>Noch keine Sessions aufgezeichnet.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {recentSessions.map((sess) => {
                    const date = sess.startedAt.toDate();
                    const dur = Math.round(sess.durationSeconds / 60);
                    return (
                      <div key={sess.id} style={sessionRowStyle}>
                        <div style={{ display: "grid", gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(date)}</span>
                          {sess.category && (
                            <span style={categoryTagStyle}>{sess.category}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ ...s.pill, fontSize: 12, padding: "4px 10px" }}>
                            {fmtMin(dur)}
                          </span>
                          <button onClick={() => removeSession(sess)} style={goalDeleteBtn} title="Session löschen">×</button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Hinweis wenn mehr als 8 Sessions vorhanden */}
                  {sessions.length > 8 && (
                    <div style={{ ...s.muted, textAlign: "center", paddingTop: 4, fontSize: 12 }}>
                      + {sessions.length - 8} weitere Sessions
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ====== Styles ====== */

// Topbar: App-Name und Logout-Button
const topbarStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: 18,
  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
  padding: "14px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

// Stats-Leiste: 4 gleichbreite Spalten
const statsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
};

// Einzelne Stat-Kachel
const statCardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: 14,
  padding: "14px 18px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

// Haupt-Grid: Links | Mitte | Rechts
const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 0.7fr",
  gap: 16,
  alignItems: "start",
};

// Roter Glow-Rahmen wenn Timer läuft
const timerRunningStyle: CSSProperties = {
  border: "1px solid rgba(229, 57, 53, 0.25)",
  boxShadow: "0 0 0 4px rgba(229, 57, 53, 0.06), 0 8px 24px rgba(0,0,0,0.08)",
};

// Rotes "läuft"-Badge in der Timer-Karte
const runningBadge: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#e53935",
  background: "rgba(229,57,53,0.08)",
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(229,57,53,0.18)",
};

// Große Timer-Ziffern
const timerDigits: CSSProperties = {
  fontSize: 56,
  fontWeight: 950,
  letterSpacing: -2,
  fontVariantNumeric: "tabular-nums", // Stabile Breite für Ziffern
  lineHeight: 1,
};

// Ziel-Zeile: Haupt-Button und Löschen-Icon nebeneinander
const goalItemStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

// Offenes Ziel als klickbare Zeile
const goalBtnOpen: CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.07)",
  background: "#fafafa",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flex: 1,
  fontSize: 14,
  fontWeight: 600,
};

// Erledigtes Ziel (grüner Hintergrund)
const goalBtnDone: CSSProperties = {
  ...goalBtnOpen,
  background: "#f1f8f1",
  border: "1px solid rgba(46, 125, 50, 0.15)",
};

// Kleiner Löschen-Button (×) rechts neben einem Ziel oder einer Session
const goalDeleteBtn: CSSProperties = {
  flexShrink: 0,
  width: 32,
  height: 32,
  padding: 0,
  borderRadius: 10,
  border: "1px solid rgba(229,57,53,0.2)",
  background: "rgba(229,57,53,0.06)",
  color: "#e53935",
  cursor: "pointer",
  fontSize: 18,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// Planungs-Abschnitt
const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

// Beschriftung eines Planungs-Abschnitts
const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1,
  opacity: 0.45,
  textTransform: "uppercase",
};

// Einzelne Monats-Zeile in der Übersichtsliste
const planRowStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.06)",
  background: "#fafafa",
  display: "grid",
  gap: 6,
  transition: "background 0.15s",
};

// Aktiver Monat in der Übersichtsliste (blau hinterlegt)
const planRowActiveStyle: CSSProperties = {
  background: "#eff4ff",
  border: "1px solid rgba(21, 101, 192, 0.2)",
};

// Einzelne Session-Zeile im Session-Verlauf
const sessionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fafafa",
  border: "1px solid rgba(0,0,0,0.06)",
  gap: 8,
};

// Blaues Tag-Label für die Session-Kategorie
const categoryTagStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#1565c0",
  background: "rgba(21, 101, 192, 0.08)",
  padding: "2px 7px",
  borderRadius: 999,
  display: "inline-block",
};

// Schließen-Button für den Fehler-Banner
const closeBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 18,
  width: "auto",
  padding: "0 4px",
};
