import { useState } from "react";
import { ScanFace, Pill } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { ScannerModal } from "@/components/scanner/ScannerModal";
import { useMedications } from "@/hooks/useMedications";

export default function Scanner() {
  const { medications, logDose } = useMedications();
  const [selectedMed, setSelectedMed] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Informative Header Banner */}
      <GlassCard className="flex gap-4" interactive={false}>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan/10 border border-cyan/20 text-cyan">
          <ScanFace className="size-5.5" />
        </div>
        <div>
          <h4 className="text-sm font-bold tracking-tight">AI Pill Vision Verification</h4>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Verify pills before consumption using our computer vision scanner. Select a medication from your schedule below to initiate capture.
          </p>
        </div>
      </GlassCard>

      {/* Select medication lists grid */}
      <div className="space-y-3.5">
        <h3 className="text-sm font-semibold tracking-wider text-fg-muted uppercase">Select Medication to Verify</h3>
        
        {medications.length ? (
          <div className="grid gap-3.5 sm:grid-cols-2">
            {medications.map((med) => (
              <GlassCard
                key={med.id}
                onClick={() => setSelectedMed(med.name)}
                className="flex items-center justify-between cursor-pointer border-white/6 hover:border-cyan/30"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/6 bg-white/[0.02] text-fg-muted">
                    <Pill className="size-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold tracking-tight text-fg">{med.name}</h4>
                    <p className="text-[10px] text-fg-faint mt-0.5">{med.dosage}</p>
                  </div>
                </div>
                <GlassButton variant="ghost" size="sm" className="pointer-events-none text-cyan">
                  Scan
                </GlassButton>
              </GlassCard>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/6 bg-white/[0.01] py-12 text-center">
            <Pill className="size-8 text-fg-faint" />
            <p className="mt-3 text-sm text-fg-muted font-medium">No medications added yet.</p>
          </div>
        )}
      </div>

      {/* Verification Scanner Modal overlay */}
      {selectedMed && (
        <ScannerModal
          open={Boolean(selectedMed)}
          onClose={() => setSelectedMed(null)}
          medicationName={selectedMed}
          onVerifySuccess={() => {
            const med = medications.find((m) => m.name === selectedMed);
            if (med) void logDose(med.id, "taken");
          }}
        />
      )}
    </div>
  );
}
