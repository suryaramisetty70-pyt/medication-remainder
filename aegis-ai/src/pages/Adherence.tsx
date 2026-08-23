import { Activity, Percent, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AdherenceChart } from "@/components/dashboard/AdherenceChart";
import { useMedications } from "@/hooks/useMedications";
import { useCountUp } from "@/hooks/useCountUp";

export default function Adherence() {
  const { analytics } = useMedications();
  const compliance = useCountUp(analytics.weeklyCompliance);
  const delta = analytics.weeklyDelta;

  return (
    <div className="space-y-6">
      {/* 1. Bar Chart Visualization */}
      <AdherenceChart days={analytics.week} />

      {/* 2. Analytical Metrics breakdown grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard className="flex items-center gap-4.5" interactive>
          <div className="flex size-12 items-center justify-center rounded-2xl border border-cyan/20 bg-cyan/10 text-cyan">
            <Percent className="size-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-fg-faint uppercase">Avg. Compliance</span>
            <h4 className="num text-xl font-extrabold mt-0.5">{Math.round(compliance)}%</h4>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-4.5" interactive>
          <div className={`flex size-12 items-center justify-center rounded-2xl border ${
            delta >= 0
              ? "border-emerald/20 bg-emerald/10 text-emerald"
              : "border-danger/20 bg-danger/10 text-danger"
          }`}>
            <Activity className="size-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-fg-faint uppercase">Weekly delta</span>
            <h4 className="num text-xl font-extrabold mt-0.5">
              {delta >= 0 ? "+" : ""}{delta}% <span className="text-xs text-fg-muted font-normal">vs last week</span>
            </h4>
          </div>
        </GlassCard>
      </div>

      {/* 3. AI Generated Coach tip/note */}
      <GlassCard className="flex gap-4" interactive={false}>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan/10 border border-cyan/20 text-cyan">
          <Sparkles className="size-4.5" />
        </div>
        <div>
          <h4 className="text-sm font-bold tracking-tight">Coach Insights</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
            {analytics.weeklyCompliance >= 90
              ? "Excellent consistency this week! Your adherence rate is in the high compliance zone, reducing risk of missed therapy advantages."
              : analytics.weeklyCompliance >= 75
              ? "Good overall compliance. Try scheduling alarms for your afternoon doses, which account for most of your missed ticks."
              : "Your adherence rate is currently low. If you're experiencing side effects or find the times difficult, use the AI health coach assistant to discuss scheduling adjustments."}
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
