import type { NotificationSchedule, PermissionState } from "@/types/notifications";
import type { Medication } from "@/types/medication";

type LocalNotificationsModule = typeof import("@capacitor/local-notifications");

let cached: LocalNotificationsModule["LocalNotifications"] | null = null;

export function isNativePlatform(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Dynamic import keeps the native plugin out of the browser bundle path. */
async function plugin() {
  if (!isNativePlatform()) return null;
  if (cached) return cached;
  const mod = await import("@capacitor/local-notifications");
  cached = mod.LocalNotifications;
  return cached;
}

/** Deterministic 31-bit id so cancel/reschedule works without persistence. */
export function notificationIdFor(medicationId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < medicationId.length; i++) {
    hash ^= medicationId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 2_000_000_000;
}

export async function getNotificationPermissionStatus(): Promise<PermissionState> {
  const ln = await plugin();
  if (!ln) return "unsupported";
  const { display } = await ln.checkPermissions();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
}

export async function requestNotificationPermissions(): Promise<PermissionState> {
  const ln = await plugin();
  if (!ln) return "unsupported";
  const { display } = await ln.requestPermissions();
  if (display === "granted") await ensureChannel();
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
}

async function ensureChannel() {
  const ln = await plugin();
  if (!ln?.createChannel) return;
  try {
    await ln.createChannel({
      id: "aegis-medication",
      name: "Medication reminders",
      description: "Scheduled reminders for your medication doses",
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch {
    /* iOS has no channels */
  }
}

/** True only when the OS will honour an exact alarm. */
export async function hasExactAlarmCapability(): Promise<boolean> {
  const ln = await plugin();
  if (!ln) return false;
  const anyLn = ln as unknown as { checkExactNotificationSetting?: () => Promise<{ exact_alarm: string }> };
  if (!anyLn.checkExactNotificationSetting) return true; // iOS / older Android: exact by default
  try {
    const res = await anyLn.checkExactNotificationSetting();
    return res.exact_alarm === "granted";
  } catch {
    return false;
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  const ln = await plugin();
  const anyLn = ln as unknown as { changeExactNotificationSetting?: () => Promise<unknown> } | null;
  await anyLn?.changeExactNotificationSetting?.();
}

export async function scheduleMedicationReminder(med: Medication): Promise<NotificationSchedule | null> {
  const ln = await plugin();
  if (!ln) return null;
  if ((await getNotificationPermissionStatus()) !== "granted") return null;

  await ensureChannel();
  const [hour, minute] = med.time.split(":").map(Number);
  const id = notificationIdFor(med.id);
  const exact = await hasExactAlarmCapability();
  const detail = [med.dosage, med.instructions].filter(Boolean).join(" — ");

  await ln.schedule({
    notifications: [
      {
        id,
        title: "Time to take your medication!",
        body: `${med.name}${detail ? ` ${detail}` : ""}`,
        channelId: "aegis-medication",
        smallIcon: "ic_stat_aegis",
        extra: { medicationId: med.id },
        schedule: {
          on: { hour: hour || 0, minute: minute || 0 },
          repeats: true,
          allowWhileIdle: true,
        },
      },
    ],
  });

  return { id, medicationId: med.id, hour: hour || 0, minute: minute || 0, exact };
}

export async function cancelMedicationReminder(medicationId: string): Promise<void> {
  const ln = await plugin();
  if (!ln) return;
  try {
    await ln.cancel({ notifications: [{ id: notificationIdFor(medicationId) }] });
  } catch {
    /* nothing scheduled */
  }
}

export async function rescheduleMedicationReminder(med: Medication) {
  await cancelMedicationReminder(med.id);
  return scheduleMedicationReminder(med);
}
