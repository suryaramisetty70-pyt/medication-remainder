import { TodayTimeline } from "@/components/timeline/TodayTimeline";
import { TimelineSkeleton } from "@/components/ui/Skeleton";
import { useMedications } from "@/hooks/useMedications";

export default function Today() {
  const { analytics, loading, logDose, pendingIds } = useMedications();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold tracking-wider text-fg-muted uppercase">Today's Schedule</h3>
        <p className="text-xs text-fg-faint mt-1">Checklist of your scheduled medication doses</p>
      </div>

      {loading && !analytics.todaySlots.length ? (
        <TimelineSkeleton />
      ) : (
        <TodayTimeline
          slots={analytics.todaySlots}
          onLog={logDose}
          pendingIds={pendingIds}
        />
      )}
    </div>
  );
}
