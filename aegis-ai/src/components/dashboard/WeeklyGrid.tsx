import { cn } from "@/lib/utils";
import type { DayAdherence } from "@/types/analytics";

const STATE_CLASSES: Record<DayAdherence["state"], string> = {
  taken:   "bg-emerald border-emerald/30 text-emerald-950",
  missed:  "bg-danger border-danger/30 text-danger-950",
  partial: "bg-gradient-to-br from-emerald to-danger border-white/20 text-fg",
  pending: "bg-white/5 border-white/10 text-fg-muted",
};

export function WeeklyGrid({ days }: { days: DayAdherence[] }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(({ label, date, compliance, state, scheduled }) => {
        const hasDecided = state !== "pending";
        return (
          <div
            key={date}
            className="flex flex-col items-center gap-1.5"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">{label}</span>
            <div
              aria-label={`${label}: ${scheduled ? `${compliance}% compliance` : "No doses"}`}
              className={cn(
                "flex size-10 items-center justify-center rounded-2xl border text-xs font-bold tracking-tight num transition-all duration-500",
                STATE_CLASSES[state],
              )}
            >
              {scheduled ? (hasDecided ? `${compliance}%` : "—") : "Ø"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
