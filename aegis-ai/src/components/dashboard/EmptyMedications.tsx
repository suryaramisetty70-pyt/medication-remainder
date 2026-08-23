import { Link } from "react-router-dom";
import { Pill, Plus } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { GlassButton } from "../ui/GlassButton";

export function EmptyMedications() {
  return (
    <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl border border-white/6 bg-white/[0.02] text-fg-faint">
        <Pill className="size-8" />
      </div>
      <h3 className="mt-6 text-lg font-bold tracking-tight text-fg">No medications scheduled</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
        Add your first medication to enable reminders, AI pill scanner verification, and adherence tracking.
      </p>
      <Link to="/medications" className="mt-8">
        <GlassButton variant="primary">
          <Plus className="size-4" /> Add Medication
        </GlassButton>
      </Link>
    </GlassCard>
  );
}
