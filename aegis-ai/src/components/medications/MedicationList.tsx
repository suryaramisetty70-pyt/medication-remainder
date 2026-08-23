import { useState } from "react";
import { Pill, Trash2, Clock, Info } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { GlassButton } from "../ui/GlassButton";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { formatTime } from "@/lib/utils";
import type { Medication } from "@/types/medication";

interface Props {
  medications: Medication[];
  onDelete: (id: string) => Promise<void> | void;
}

export function MedicationList({ medications, onDelete }: Props) {
  const [targetId, setTargetId] = useState<string | null>(null);

  if (!medications.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-white/6 bg-white/[0.01] py-12 text-center">
        <Pill className="size-8 text-fg-faint" />
        <p className="mt-3 text-sm text-fg-muted font-medium">No medications added yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {medications.map((med) => (
        <GlassCard key={med.id} className="group relative" interactive>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/6 bg-white/[0.02] text-fg-muted">
                <Pill className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h4 className="text-base font-bold tracking-tight text-fg">{med.name}</h4>
                  <span className="text-xs text-fg-muted">({med.dosage})</span>
                </div>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-fg-faint num font-medium">
                  <Clock className="size-3" /> {formatTime(med.time)}
                </p>
                {med.instructions && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
                    <Info className="size-3 text-cyan" />
                    {med.instructions}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-white/6 pt-3 sm:border-none sm:pt-0">
              <GlassButton
                variant="ghost" size="sm"
                onClick={() => setTargetId(med.id)}
                className="opacity-0 group-hover:opacity-100 hover:text-danger"
              >
                <Trash2 className="size-4" /> Delete
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      ))}

      <ConfirmDialog
        open={Boolean(targetId)}
        title="Delete medication?"
        description="This will permanently delete this medication and all of its associated logs from your schedule."
        onConfirm={async () => { if (targetId) await onDelete(targetId); }}
        onClose={() => setTargetId(null)}
      />
    </div>
  );
}
