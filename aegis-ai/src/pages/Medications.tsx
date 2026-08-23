import { useState } from "react";
import { Plus } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { MedicationForm } from "@/components/medications/MedicationForm";
import { MedicationList } from "@/components/medications/MedicationList";
import { useMedications } from "@/hooks/useMedications";

export default function Medications() {
  const { medications, addMedication, removeMedication } = useMedications();
  const [formOpen, setFormOpen] = useState(false);

  const handleAdd = async (input: Parameters<typeof addMedication>[0]) => {
    await addMedication(input);
    setFormOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* List header banner */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-wider text-fg-muted uppercase">Your Schedule</h3>
          <p className="text-xs text-fg-faint mt-1">Manage medications and daily alarm intervals</p>
        </div>
        <GlassButton variant="primary" onClick={() => setFormOpen(true)}>
          <Plus className="size-4" /> Add Dose
        </GlassButton>
      </div>

      <MedicationList medications={medications} onDelete={removeMedication} />

      {/* Medication Scheduler Modal */}
      <GlassModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Schedule Medication"
        subtitle="Set timing and instructions for automatic reminders"
        className="sm:max-w-md"
      >
        <MedicationForm onSubmit={handleAdd} onCancel={() => setFormOpen(false)} />
      </GlassModal>
    </div>
  );
}
