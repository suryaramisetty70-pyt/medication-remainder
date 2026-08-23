import type { Medication } from "@/types/medication";
import type { MedicationLog } from "@/types/logs";
import type { Analytics, DayAdherence, DoseSlot } from "@/types/analytics";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const UPCOMING_WINDOW_MS = 60 * 60 * 1000;

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function scheduledDate(day: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Monday-first week containing `ref`. */
function weekDays(ref: Date): Date[] {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function logIndex(logs: MedicationLog[]): Map<string, MedicationLog["status"]> {
  const map = new Map<string, MedicationLog["status"]>();
  for (const log of logs) {
    const d = new Date(log.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    map.set(`${log.medication_id}|${dateKey(d)}`, log.status);
  }
  return map;
}

export function buildSlots(
  meds: Medication[],
  logs: MedicationLog[],
  day: Date,
  now = new Date(),
): DoseSlot[] {
  const index = logIndex(logs);
  const key = dateKey(day);

  return meds
    .map<DoseSlot>((med) => {
      const scheduledAt = scheduledDate(day, med.time);
      const logged = index.get(`${med.id}|${key}`);
      let status: DoseSlot["status"];

      if (logged) status = logged;
      else if (scheduledAt.getTime() > now.getTime() + UPCOMING_WINDOW_MS) status = "upcoming";
      else if (scheduledAt.getTime() > now.getTime()) status = "pending";
      else if (key < dateKey(now)) status = "missed";
      else status = "pending";

      return {
        key: `${med.id}|${key}`,
        medicationId: med.id,
        name: med.name,
        dosage: med.dosage,
        instructions: med.instructions,
        time: med.time,
        date: key,
        scheduledAt,
        status,
      };
    })
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

function summarise(day: Date, slots: DoseSlot[]): DayAdherence {
  const taken = slots.filter((s) => s.status === "taken").length;
  const missed = slots.filter((s) => s.status === "missed").length;
  const pending = slots.length - taken - missed;
  const decided = taken + missed;
  const compliance = decided ? Math.round((taken / decided) * 100) : 0;

  const state: DayAdherence["state"] =
    !slots.length || (!taken && !missed) ? "pending"
    : missed === 0 && pending === 0 ? "taken"
    : taken === 0 ? "missed"
    : "partial";

  return {
    date: dateKey(day),
    label: DAY_LABELS[day.getDay()],
    scheduled: slots.length,
    taken, missed, pending, compliance, state,
  };
}

export function computeAnalytics(
  meds: Medication[],
  logs: MedicationLog[],
  now = new Date(),
): Analytics {
  const todaySlots = buildSlots(meds, logs, now, now);
  const today = summarise(now, todaySlots);

  const week = weekDays(now).map((d) => summarise(d, buildSlots(meds, logs, d, now)));

  const prevRef = new Date(now);
  prevRef.setDate(prevRef.getDate() - 7);
  const prevWeek = weekDays(prevRef).map((d) => summarise(d, buildSlots(meds, logs, d, now)));

  const avg = (days: DayAdherence[]) => {
    const active = days.filter((d) => d.taken + d.missed > 0);
    return active.length ? Math.round(active.reduce((s, d) => s + d.compliance, 0) / active.length) : 0;
  };

  // Streak: consecutive fully-taken past days, today counted only when complete.
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const summary = summarise(d, buildSlots(meds, logs, d, now));
    if (!summary.scheduled) { if (i === 0) continue; break; }
    if (summary.state === "taken") streak++;
    else if (i === 0 && summary.missed === 0) continue; // today still in progress
    else break;
  }

  const nextDose =
    todaySlots.find((s) => (s.status === "pending" || s.status === "upcoming") && s.scheduledAt >= now) ?? null;

  return {
    today,
    todaySlots,
    week,
    streak,
    weeklyCompliance: avg(week),
    weeklyDelta: avg(week) - avg(prevWeek),
    nextDose,
  };
}
