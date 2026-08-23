import { GlassCard } from "../ui/GlassCard";
import type { DayAdherence } from "@/types/analytics";

export function AdherenceChart({ days }: { days: DayAdherence[] }) {
  return (
    <GlassCard className="space-y-6">
      <h4 className="text-sm font-semibold tracking-wide text-fg-muted uppercase">Daily Adherence Rate</h4>
      <div className="flex h-44 items-end justify-between gap-2 px-2 pb-1">
        {days.map((day) => {
          const height = day.scheduled ? `${Math.max(day.compliance, 6)}%` : "0%";
          return (
            <div key={day.date} className="group relative flex flex-1 flex-col items-center gap-2 h-full justify-end">
              {/* tooltip bubble */}
              <div className="pointer-events-none absolute bottom-full mb-2 scale-90 rounded-xl bg-cyan px-2 py-1 text-[10px] font-bold text-obsidian opacity-0 shadow-lg transition duration-200 group-hover:translate-y-[-2px] group-hover:scale-100 group-hover:opacity-100">
                {day.compliance}%
              </div>
              {/* bar fill */}
              <div
                className="w-full rounded-t-xl bg-gradient-to-t from-cyan to-teal opacity-75 transition-all duration-700 hover:opacity-100"
                style={{ height }}
              />
              <span className="text-[10px] font-medium text-fg-faint">{day.label}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
