import { useState } from "react";
import { GlassInput, GlassTextarea } from "../ui/GlassInput";
import { GlassButton } from "../ui/GlassButton";
import type { MedicationInput } from "@/types/medication";

interface Props {
  onSubmit: (input: MedicationInput) => Promise<void> | void;
  onCancel?: () => void;
}

export function MedicationForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("08:00");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (!dosage.trim()) { setError("Dosage is required"); return; }
    if (!time) { setError("Time is required"); return; }

    setError(null);
    setBusy(true);
    try {
      await onSubmit({ name, dosage, time, instructions });
      setName(""); setDosage(""); setTime("08:00"); setInstructions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-5">
      <div className="space-y-4">
        <GlassInput
          label="Medication Name" placeholder="e.g. Aspirin, Lipitor"
          value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassInput
            label="Dosage" placeholder="e.g. 100mg, 1 tablet"
            value={dosage} onChange={(e) => setDosage(e.target.value)} disabled={busy}
          />
          <GlassInput
            label="Time" type="time"
            value={time} onChange={(e) => setTime(e.target.value)} disabled={busy}
          />
        </div>
        <GlassTextarea
          label="Instructions (Optional)" placeholder="e.g. Take with food, Avoid grapefruit"
          value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={busy}
        />
      </div>

      {error && <p role="alert" className="text-xs text-danger font-medium">{error}</p>}

      <div className="flex justify-end gap-2.5">
        {onCancel && <GlassButton variant="ghost" type="button" onClick={onCancel}>Cancel</GlassButton>}
        <GlassButton variant="primary" type="submit" loading={busy}>Save Schedule</GlassButton>
      </div>
    </form>
  );
}
