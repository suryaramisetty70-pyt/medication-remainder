import { TrendingUp, Flame, CheckCircle2 } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { Sparkline } from "./Sparkline";
import { useCountUp } from "@/hooks/useCountUp";
import type { Analytics } from "@/types/analytics";

export function KpiCards({ analytics }: { analytics: Analytics }) {
  const compliance = useCountUp(analytics.weeklyCompliance);
  const streak = useCountUp(analytics.streak);
  
  // Calculate today's decided dose counts
  const taken = analytics.today.taken;
  const total = analytics.today.scheduled;
  const done = analytics.today.taken + analytics.today.missed;

  const sparkData = analytics.week.map((d) => d.compliance);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* weekly compliance */}
      <GlassCard className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-fg-muted uppercase">Weekly Adherence</span>
            <TrendingUp className="size-4 text-cyan" />
          </div>
          <h3 className="num mt-4 text-3xl font-extrabold tracking-tight">
            {Math.round(compliance)}%
          </h3>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3">
          <span className="text-[10px] text-fg-faint uppercase font-medium">Compliance Trend</span>
          <Sparkline data={sparkData} />
        </div>
      </GlassCard>

      {/* current streak */}
      <GlassCard className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-fg-muted uppercase">Streak</span>
            <Flame className="size-4 text-orange-400" />
          </div>
          <h3 className="num mt-4 text-3xl font-extrabold tracking-tight">
            {Math.round(streak)} Day{analytics.streak === 1 ? "" : "s"}
          </h3>
        </div>
        <div className="mt-4 border-t border-white/6 pt-3 text-[11px] text-fg-muted font-medium">
          {analytics.streak > 0 ? "You're doing awesome. Keep it up!" : "Log a full day of doses to start your streak!"}
        </div>
      </GlassCard>

      {/* today progress */}
      <GlassCard className="flex flex-col justify-between sm:col-span-2 xl:col-span-1">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-fg-muted uppercase">Today's Progress</span>
            <CheckCircle2 className="size-4 text-emerald" />
          </div>
          <h3 className="num mt-4 text-3xl font-extrabold tracking-tight">
            {taken} / {total}
          </h3>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-white/6 pt-3">
          <div className="flex justify-between text-[10px] text-fg-faint uppercase font-semibold">
            <span>Doses log rate</span>
            <span>{done} of {total} done</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-cyan to-teal transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
