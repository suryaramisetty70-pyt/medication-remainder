import { DoseCard } from "./DoseCard";
import type { DoseSlot } from "@/types/analytics";

interface Props {
  slots: DoseSlot[];
  onLog: (id: string, status: "taken" | "missed") => Promise<void> | void;
  pendingIds: Set<string>;
}

export function TodayTimeline({ slots, onLog, pendingIds }: Props) {
  if (!slots.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/6 bg-white/[0.01] py-12 text-center">
        <p className="text-sm text-fg-muted font-medium">No doses scheduled for today.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-3.5">
      {/* timeline left connector bar */}
      <div className="absolute left-[38px] top-6 bottom-6 w-px bg-white/6" aria-hidden />

      {slots.map((slot) => (
        <DoseCard
          key={slot.key}
          slot={slot}
          onLog={onLog}
          pending={pendingIds.has(slot.medicationId)}
        />
      ))}
    </div>
  );
}
