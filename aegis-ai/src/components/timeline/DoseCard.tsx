import { useState } from "react";
import { Check, X, Play, RefreshCw, Clock } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { GlassButton } from "../ui/GlassButton";
import { GlassBadge } from "../ui/GlassBadge";
import { ScannerModal } from "../scanner/ScannerModal";
import { cn, formatTime } from "@/lib/utils";
import type { DoseSlot } from "@/types/analytics";

interface Props {
  slot: DoseSlot;
  onLog: (id: string, status: "taken" | "missed") => Promise<void> | void;
  pending: boolean;
}

export function DoseCard({ slot, onLog, pending }: Props) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState<"taken" | "missed" | null>(null);

  const handleAction = async (status: "taken" | "missed") => {
    setBusy(status);
    try {
      await onLog(slot.medicationId, status);
    } finally {
      setBusy(null);
    }
  };

  const isDecided = slot.status === "taken" || slot.status === "missed";
  const isPending = slot.status === "pending";

  return (
    <GlassCard className="group relative" interactive>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* circle indicator */}
          <div className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500",
            slot.status === "taken" && "bg-emerald/10 border-emerald/20 text-emerald",
            slot.status === "missed" && "bg-danger/10 border-danger/20 text-danger",
            slot.status === "pending" && "bg-white/5 border-white/12 text-fg-muted",
            slot.status === "upcoming" && "bg-cyan/10 border-cyan/25 text-cyan",
          )}>
            {slot.status === "taken" ? <Check className="size-5" />
              : slot.status === "missed" ? <X className="size-5" />
              : <Clock className="size-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h4 className="text-base font-bold tracking-tight">{slot.name}</h4>
              <span className="text-xs text-fg-muted">({slot.dosage})</span>
            </div>
            <p className="mt-0.5 text-xs text-fg-faint num">{formatTime(slot.time)}</p>
            {slot.instructions && (
              <p className="mt-1 text-xs text-fg-muted">Note: {slot.instructions}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/6 pt-3 sm:border-none sm:pt-0">
          <div className="sm:hidden">
            <GlassBadge status={slot.status} />
          </div>

          <div className="flex items-center gap-1.5">
            {isPending && (
              <>
                <GlassButton
                  variant="ghost" size="sm" loading={busy === "missed" || pending}
                  onClick={() => handleAction("missed")}
                >
                  Skip
                </GlassButton>
                <GlassButton
                  variant="primary" size="sm" loading={busy === "taken" || pending}
                  onClick={() => handleAction("taken")}
                >
                  Take
                </GlassButton>
                <GlassButton
                  variant="success" size="sm" disabled={pending}
                  onClick={() => setScannerOpen(true)}
                >
                  <Play className="size-2.5 fill-current" /> Verify
                </GlassButton>
              </>
            )}

            {isDecided && (
              <div className="flex items-center gap-3">
                <GlassBadge status={slot.status} className="hidden sm:inline-flex" />
                <GlassButton
                  variant="ghost" size="sm" disabled={pending} className="opacity-0 group-hover:opacity-100"
                  onClick={() => handleAction(slot.status === "taken" ? "missed" : "taken")}
                >
                  <RefreshCw className="size-3" /> Change
                </GlassButton>
              </div>
            )}

            {slot.status === "upcoming" && (
              <GlassBadge status="upcoming" className="hidden sm:inline-flex" />
            )}
          </div>
        </div>
      </div>

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        medicationName={slot.name}
        onVerifySuccess={() => onLog(slot.medicationId, "taken")}
      />
    </GlassCard>
  );
}
