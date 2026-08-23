import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getNotificationPermissionStatus, hasExactAlarmCapability, isNativePlatform,
  openExactAlarmSettings, requestNotificationPermissions,
} from "@/services/notifications";
import type { PermissionState } from "@/types/notifications";

const DISMISS_KEY = "aegis:notif-prompt-dismissed";

export function useNotifications() {
  const [status, setStatus] = useState<PermissionState>("unsupported");
  const [exact, setExact] = useState(true);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1",
  );

  const sync = useCallback(async () => {
    const s = await getNotificationPermissionStatus();
    setStatus(s);
    if (s === "granted") setExact(await hasExactAlarmCapability());
  }, []);

  useEffect(() => { void sync(); }, [sync]);

  const enable = useCallback(async () => {
    const s = await requestNotificationPermissions();
    setStatus(s);
    if (s === "granted") {
      setExact(await hasExactAlarmCapability());
      toast.success("Medication reminders enabled");
    } else if (s === "denied") {
      localStorage.setItem(DISMISS_KEY, "1"); // never nag again
      setDismissed(true);
      toast.warning("Notification permission required for reminders");
    }
    return s;
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  return {
    native: isNativePlatform(),
    status, exact, dismissed,
    shouldPrompt: isNativePlatform() && status !== "granted" && !dismissed,
    enable, dismiss, sync,
    openExactAlarmSettings,
  };
}
