import { Bell, ShieldAlert, X } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { GlassButton } from "../ui/GlassButton";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationPrompt() {
  const { shouldPrompt, exact, enable, dismiss, openExactAlarmSettings } = useNotifications();

  if (!shouldPrompt) {
    // case where notifications are on, but exact alarms setting is disabled
    if (exact === false) {
      return (
        <GlassCard className="border-amber/30 bg-amber/12 p-4 relative" interactive={false}>
          <div className="flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber/20 text-amber">
              <ShieldAlert className="size-5.5" />
            </div>
            <div className="pr-8">
              <h4 className="text-sm font-bold tracking-tight text-amber">Precise reminders disabled</h4>
              <p className="mt-1 text-xs text-amber-100/75 leading-relaxed">
                Android requires explicit permission for precise timing. Without this, your medication reminders may arrive late.
              </p>
              <GlassButton
                variant="ghost" size="sm" onClick={openExactAlarmSettings}
                className="mt-3.5 border-amber/35 text-amber hover:bg-amber/15 hover:border-amber/50"
              >
                Enable Precise Alarms
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      );
    }
    return null;
  }

  return (
    <GlassCard className="relative overflow-hidden" interactive={false}>
      <div className="flex gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan/10 border border-cyan/20 text-cyan">
          <Bell className="size-5.5" />
        </div>
        <div className="pr-8">
          <h4 className="text-sm font-bold tracking-tight">Enable smart reminders?</h4>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Aegis can ring local alarms on your phone system to notify you of medications even when the app is completely closed.
          </p>
          <div className="mt-3.5 flex items-center gap-2">
            <GlassButton variant="primary" size="sm" onClick={enable}>Enable</GlassButton>
            <GlassButton variant="ghost" size="sm" onClick={dismiss}>Not Now</GlassButton>
          </div>
        </div>
      </div>
      <button
        onClick={dismiss} aria-label="Dismiss banner"
        className="absolute right-4 top-4 rounded-lg p-1 text-fg-muted transition hover:text-fg hover:bg-white/5"
      >
        <X className="size-4" />
      </button>
    </GlassCard>
  );
}
