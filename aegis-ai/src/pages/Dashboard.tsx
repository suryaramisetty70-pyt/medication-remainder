import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { GlassCard } from "@/components/ui/GlassCard";
import { KpiSkeleton } from "@/components/ui/Skeleton";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { NextDoseCard } from "@/components/dashboard/NextDoseCard";
import { WeeklyGrid } from "@/components/dashboard/WeeklyGrid";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import { EmptyMedications } from "@/components/dashboard/EmptyMedications";
import { ErrorState } from "@/components/dashboard/ErrorState";
import { useMedications } from "@/hooks/useMedications";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function Dashboard() {
  const { medications, analytics, loading, error, pendingIds, refresh, logDose } = useMedications();

  if (loading && !medications.length) {
    return (
      <div className="space-y-6">
        <KpiSkeleton />
      </div>
    );
  }

  if (error && !medications.length) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  if (!medications.length) {
    return <EmptyMedications />;
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* 1. KPIs Section */}
      <motion.div variants={item}>
        <KpiCards analytics={analytics} />
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 2. Next Dose Segment */}
        <motion.div variants={item} className="md:col-span-2">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-sm font-semibold tracking-wider text-fg-muted uppercase">Next Up</h3>
            <Link to="/today" className="text-xs font-semibold text-cyan hover:underline">
              View Schedule
            </Link>
          </div>
          <NextDoseCard
            nextDose={analytics.nextDose}
            onLog={logDose}
            pending={Boolean(analytics.nextDose && pendingIds.has(analytics.nextDose.medicationId))}
          />
        </motion.div>

        {/* 3. Weekly Summary Ring Grid */}
        <motion.div variants={item}>
          <h3 className="text-sm font-semibold tracking-wider text-fg-muted uppercase mb-3.5">Today</h3>
          <GlassCard className="flex flex-col items-center justify-center py-7.5" interactive>
            <ProgressRing value={analytics.today.compliance} />
          </GlassCard>
        </motion.div>
      </div>

      {/* 4. Week Grid Calendar Timeline */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-sm font-semibold tracking-wider text-fg-muted uppercase">Weekly Overview</h3>
          <Link to="/adherence" className="text-xs font-semibold text-cyan hover:underline">
            View Analytics
          </Link>
        </div>
        <GlassCard className="py-6.5" interactive>
          <WeeklyGrid days={analytics.week} />
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
