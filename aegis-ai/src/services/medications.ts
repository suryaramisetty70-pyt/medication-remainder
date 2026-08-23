import { request } from "./api";
import type { Medication, MedicationInput } from "@/types/medication";

function normalise(raw: Record<string, unknown>): Medication {
  const time = String(raw.time ?? raw.schedule_time ?? "08:00").slice(0, 5);
  return {
    id: String(raw.id ?? raw._id ?? crypto.randomUUID()),
    name: String(raw.name ?? raw.medication_name ?? "Unknown"),
    dosage: String(raw.dosage ?? raw.dose ?? ""),
    time,
    instructions: (raw.instructions ?? raw.notes ?? null) as string | null,
    created_at: raw.created_at as string | undefined,
  };
}

export async function listMedications(): Promise<Medication[]> {
  const data = await request<unknown>("/medications");
  const arr = Array.isArray(data)
    ? data
    : ((data as { medications?: unknown[] })?.medications ?? []);
  return (arr as Record<string, unknown>[]).map(normalise);
}

export async function createMedication(input: MedicationInput): Promise<Medication> {
  const data = await request<Record<string, unknown>>("/medications", {
    method: "POST",
    body: {
      name: input.name.trim(),
      dosage: input.dosage.trim(),
      time: input.time,
      instructions: input.instructions?.trim() || null,
    },
  });
  return normalise(data ?? {});
}

export async function deleteMedication(id: string): Promise<void> {
  await request<void>(`/medications/${encodeURIComponent(id)}`, { method: "DELETE" });
}
