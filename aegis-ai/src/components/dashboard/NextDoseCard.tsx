import { useState } from "react";
import { Clock, Play, Info } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { GlassButton } from "../ui/GlassButton";
import { GlassBadge } from "../ui/GlassBadge";
import { ScannerModal } from "../scanner/ScannerModal";
import { countdown, formatTime } from "@/lib/utils";
import type { DoseSlot } from "@/types/analytics";

interface Props {
  nextDose: DoseSlot | null;
  onLog: (id: string, status: "taken" | "missed") => Promise<void> | void;
  pending: boolean;
}

export function NextDoseCard({ nextDose, onLog, pending }: Props) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [logging, setLogging] = useState(false);

  if (!nextDose) {
    return (
      <GlassCard className="flex flex-col items-center justify-center py-10 text-center">
        <Clock className="size-8 text-fg-faint" />
        <h4 className="mt-4 text-sm font-semibold">No more doses scheduled today</h4>
        <p className="mt-1 text-xs text-fg-faint">Enjoy the rest of your day!</p>
      </GlassCard>
    );
  }

  const handleTaken = async () => {
    setLogging(true);
    try {
      await onLog(nextDose.medicationId, "taken");
    } finally {
      setLogging(false);
    }
  };

  return (
    <GlassCard className="relative overflow-hidden">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-cyan/20 bg-cyan/10 text-cyan">
            <Clock className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h4 className="text-lg font-bold tracking-tight">{nextDose.name}</h4>
              <GlassBadge status="upcoming" />
            </div>
            <p className="mt-1 text-sm font-semibold text-cyan num">
              {formatTime(nextDose.time)} <span className="text-xs text-fg-muted font-normal">({countdown(nextDose.scheduledAt)})</span>
            </p>
            {nextDose.instructions && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-1.5 text-xs text-fg-muted">
                <Info className="size-3 text-cyan" />
                {nextDose.instructions}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-white/6 pt-4 sm:border-none sm:pt-0">
          <GlassButton
            variant="primary" size="sm" loading={logging || pending}
            onClick={handleTaken}
          >
            Mark Taken
          </GlassButton>
          <GlassButton
            variant="success" size="sm" disabled={pending}
            onClick={() => setScannerOpen(true)}
          >
            <Play className="size-3 fill-current" /> Verify & Take
          </GlassButton>
        </div>
      </div>

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        medicationName={nextDose.name}
        onVerifySuccess={() => onLog(nextDose.medicationId, "taken")}
      />
    </GlassCard>
  );
}
