import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { toast } from "sonner";
import { ApiError, healthCheck } from "@/services/api";
import { createMedication, deleteMedication, listMedications } from "@/services/medications";
import { createLog, listLogs } from "@/services/logs";
import { computeAnalytics } from "@/services/analytics";
import {
  cancelMedicationReminder, isNativePlatform, scheduleMedicationReminder,
} from "@/services/notifications";
import { useLiveTime } from "./useLiveTime";
import type { Medication, MedicationInput } from "@/types/medication";
import type { MedicationLog } from "@/types/logs";
import type { Analytics } from "@/types/analytics";

interface Store {
  medications: Medication[];
  logs: MedicationLog[];
  analytics: Analytics;
  loading: boolean;
  error: string | null;
  online: boolean;
  now: Date;
  pendingIds: Set<string>;
  refresh: () => Promise<void>;
  addMedication: (input: MedicationInput) => Promise<Medication>;
  removeMedication: (id: string) => Promise<void>;
  logDose: (medicationId: string, status: "taken" | "missed") => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function MedicationProvider({ children }: { children: ReactNode }) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const mounted = useRef(true);
  const now = useLiveTime();

  useEffect(() => () => { mounted.current = false; }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [meds, logRows] = await Promise.all([listMedications(), listLogs()]);
      if (!mounted.current) return;
      setMedications(meds);
      setLogs(logRows);
      setError(null);
      setOnline(true);
    } catch (err) {
      if (!mounted.current) return;
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      setError(message);
      setOnline(err instanceof ApiError ? !err.offline : false);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void healthCheck().then((ok) => mounted.current && setOnline(ok));
  }, [refresh]);

  const addMedication = useCallback(async (input: MedicationInput) => {
    const med = await createMedication(input);
    setMedications((prev) => [...prev, med]);
    setError(null);
    setOnline(true);
    toast.success("Medication added successfully");

    if (isNativePlatform()) {
      const scheduled = await scheduleMedicationReminder(med);
      if (scheduled?.exact) toast.success(`Reminder scheduled for ${med.time}`);
      else if (scheduled) toast.warning("Reminder scheduled, but the system may deliver it late (exact alarms are off).");
      else toast.warning("Notification permission required to schedule this reminder.");
    }
    return med;
  }, []);

  const removeMedication = useCallback(async (id: string) => {
    await cancelMedicationReminder(id);
    await deleteMedication(id);
    setMedications((prev) => prev.filter((m) => m.id !== id));
    setLogs((prev) => prev.filter((l) => l.medication_id !== id));
    toast.success("Medication removed from your schedule");
  }, []);

  const logDose = useCallback(async (medicationId: string, status: "taken" | "missed") => {
    setPendingIds((prev) => new Set(prev).add(medicationId));

    // Optimistic: safe because a failure rolls the entry straight back out.
    const optimistic: MedicationLog = {
      id: `optimistic-${medicationId}`,
      medication_id: medicationId,
      status,
      timestamp: new Date().toISOString(),
    };
    setLogs((prev) => [...prev.filter((l) => l.id !== optimistic.id), optimistic]);

    try {
      const med = medications.find((m) => m.id === medicationId);
      const todayStr = new Date().toISOString().split("T")[0];
      const scheduledTime = med ? `${todayStr} ${med.time}` : `${todayStr} 08:00`;

      const saved = await createLog({
        medication_id: medicationId,
        status,
        scheduled_time: scheduledTime,
      });
      setLogs((prev) => prev.map((l) => (l.id === optimistic.id ? saved : l)));
      toast.success(status === "taken" ? "Dose logged" : "Dose marked as missed");
      setOnline(true);
    } catch (err) {
      setLogs((prev) => prev.filter((l) => l.id !== optimistic.id));
      toast.error(err instanceof ApiError ? err.message : "Unable to log that dose.");
      throw err;
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(medicationId);
        return next;
      });
    }
  }, []);

  const analytics = useMemo(() => computeAnalytics(medications, logs, now), [medications, logs, now]);

  const value = useMemo<Store>(() => ({
    medications, logs, analytics, loading, error, online, now, pendingIds,
    refresh, addMedication, removeMedication, logDose,
  }), [medications, logs, analytics, loading, error, online, now, pendingIds, refresh, addMedication, removeMedication, logDose]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMedications(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMedications must be used inside <MedicationProvider>");
  return ctx;
}
