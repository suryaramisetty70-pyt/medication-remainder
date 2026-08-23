import { request } from "./api";
import type { LogInput, MedicationLog } from "@/types/logs";

function normalise(raw: Record<string, unknown>): MedicationLog {
  // Map scheduled_time or timestamp to timestamp
  const ts = String(raw.timestamp ?? raw.scheduled_time ?? raw.created_at ?? raw.date ?? new Date().toISOString());
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    medication_id: String(raw.medication_id ?? raw.medicationId ?? raw.med_id ?? ""),
    status: (raw.status === "missed" ? "missed" : "taken"),
    timestamp: ts,
  };
}

export async function listLogs(): Promise<MedicationLog[]> {
  try {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 30); // Get last 30 days of logs
    const startStr = start.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];
    
    const data = await request<unknown>(`/logs?start_date=${startStr}&end_date=${endStr}`);
    const arr = Array.isArray(data) ? data : ((data as { logs?: unknown[] })?.logs ?? []);
    return (arr as Record<string, unknown>[]).map(normalise);
  } catch {
    return []; // logs history is optional on the backend
  }
}

export async function createLog(input: LogInput): Promise<MedicationLog> {
  const todayStr = new Date().toISOString().split('T')[0];
  const scheduledTime = input.scheduled_time || `${todayStr} 08:00`;
  
  const data = await request<Record<string, unknown>>("/logs", {
    method: "POST",
    body: {
      medication_id: parseInt(input.medication_id, 10),
      status: input.status,
      scheduled_time: scheduledTime,
    },
  });
  return {
    id: String(data?.id ?? crypto.randomUUID()),
    medication_id: input.medication_id,
    status: input.status,
    timestamp: new Date().toISOString(),
  };
}
