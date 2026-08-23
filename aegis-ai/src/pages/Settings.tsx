import { Bell, Shield, HelpCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { WarningBadge } from "@/components/ui/GlassBadge";
import { useNotifications } from "@/hooks/useNotifications";

export default function Settings() {
  const { native, status, exact, enable, openExactAlarmSettings } = useNotifications();

  return (
    <div className="space-y-6">
      {/* 1. Notifications segment */}
      <div className="space-y-3.5">
        <h3 className="text-sm font-semibold tracking-wider text-fg-muted uppercase">Notification Preferences</h3>
        <GlassCard className="space-y-5" interactive={false}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan/10 border border-cyan/20 text-cyan">
                <Bell className="size-5.5" />
              </div>
              <div>
                <h4 className="text-sm font-bold tracking-tight">Medication Alerts</h4>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                  Receive local system push notifications when it is time to consume scheduled medications.
                </p>
                <div className="mt-2.5">
                  {status === "granted" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald/30 bg-emerald/12 px-2.5 py-1 text-[11px] font-medium text-emerald">
                      Active Reminders
                    </span>
                  ) : status === "denied" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/12 px-2.5 py-1 text-[11px] font-medium text-danger">
                      Access Blocked (Update system setting)
                    </span>
                  ) : status === "unsupported" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-fg-muted">
                      Unsupported in browser
                    </span>
                  ) : (
                    <GlassButton variant="primary" size="sm" onClick={enable}>
                      Grant Access
                    </GlassButton>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Android exact alarms sub-setting */}
          {status === "granted" && exact === false && (
            <div className="flex items-start gap-4 border-t border-white/6 pt-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber/10 border border-amber/20 text-amber">
                <Shield className="size-5.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold tracking-tight text-amber">Precise reminders inactive</h4>
                  <WarningBadge>Late alerts warning</WarningBadge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                  On Android, the OS may delay notifications to save battery. Enable exact timing settings for uninterrupted alerts.
                </p>
                <GlassButton
                  variant="ghost" size="sm" onClick={openExactAlarmSettings}
                  className="mt-3.5 border-amber/35 text-amber hover:bg-amber/15"
                >
                  Enable Exact Alarms Settings
                </GlassButton>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* 2. Platform info segment */}
      <div className="space-y-3.5">
        <h3 className="text-sm font-semibold tracking-wider text-fg-muted uppercase">Device Diagnostics</h3>
        <GlassCard className="grid gap-4 sm:grid-cols-2" interactive={false}>
          <div className="flex items-center justify-between border-b border-white/4 pb-3.5 sm:border-none sm:pb-0">
            <span className="text-xs text-fg-muted">Platform environment</span>
            <span className="text-xs font-semibold text-fg">{native ? "Native Mobile App" : "Standard Web Browser"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-muted">Verification Engine</span>
            <span className="text-xs font-semibold text-cyan">Gemini 2.5 Flash Pill Vision</span>
          </div>
        </GlassCard>
      </div>

      {/* 3. Help disclaimer segment */}
      <GlassCard className="flex gap-4" interactive={false}>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/8 text-fg-faint">
          <HelpCircle className="size-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold tracking-tight text-fg-muted">Medical Disclaimer</h4>
          <p className="mt-1.5 text-[11px] leading-relaxed text-fg-faint">
            Aegis AI is an adherence organizer and visual helper assistant. It does not replace medical supervision, prescriptions, or diagnostics. For all health decisions, verify directly with a licensed physician.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
