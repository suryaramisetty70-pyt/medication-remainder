import type { DoseStatus } from "./logs";

export interface DoseSlot {
  key: string;
  medicationId: string;
  name: string;
  dosage: string;
  instructions?: string | null;
  time: string;
  date: string;            // yyyy-mm-dd
  scheduledAt: Date;
  status: DoseStatus;
}

export interface DayAdherence {
  date: string;
  label: string;
  scheduled: number;
  taken: number;
  missed: number;
  pending: number;
  compliance: number;      // 0..100
  state: "taken" | "missed" | "partial" | "pending";
}

export interface Analytics {
  today: DayAdherence;
  todaySlots: DoseSlot[];
  week: DayAdherence[];
  streak: number;
  weeklyCompliance: number;
  weeklyDelta: number;
  nextDose: DoseSlot | null;
}
