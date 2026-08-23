export type DoseStatus = "taken" | "missed" | "pending" | "upcoming";

export interface MedicationLog {
  id: string;
  medication_id: string;
  status: Extract<DoseStatus, "taken" | "missed">;
  timestamp: string;          // ISO
}

export interface LogInput {
  medication_id: string;
  status: "taken" | "missed";
  scheduled_time?: string;    // "YYYY-MM-DD HH:MM"
}
