import { CheckCircle2, XCircle, Info, ChevronRight } from "lucide-react";
import { GlassButton } from "../ui/GlassButton";
import { GlassCard } from "../ui/GlassCard";
import type { VerificationResponse } from "@/types/scanner";

interface Props {
  result: VerificationResponse;
  medicationName: string;
  onConfirm: () => void;
  onRetry: () => void;
}

export function VerificationResult({ result, medicationName, onConfirm, onRetry }: Props) {
  const percentage = Math.round(result.confidence * 100);

  return (
    <div className="space-y-6 p-5">
      {/* 1. Header Hero Card */}
      <div className="flex flex-col items-center text-center">
        {result.verified ? (
          <>
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald/10 text-emerald">
              <CheckCircle2 className="size-10" />
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-fg">Verification Passed</h3>
            <p className="mt-1 text-sm text-fg-muted">
              Pill matched your schedule for <strong className="text-fg">{medicationName}</strong>.
            </p>
          </>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
              <XCircle className="size-10" />
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-fg">Verification Failed</h3>
            <p className="mt-1 text-sm text-fg-muted">
              Aegis could not verify this pill as <strong className="text-fg">{medicationName}</strong>.
            </p>
          </>
        )}
      </div>

      {/* 2. Confidence Indicator */}
      <GlassCard className="flex items-center justify-between" interactive={false}>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Match Confidence</span>
          <p className="num text-2xl font-extrabold text-cyan mt-1">{percentage}%</p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full rounded-full transition-all duration-700 ${result.verified ? "bg-emerald" : "bg-danger"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </GlassCard>

      {/* 3. Matched pill vision notes */}
      {result.message && (
        <div className="flex gap-2.5 rounded-2xl border border-white/6 bg-white/[0.02] p-4 text-xs leading-relaxed text-fg-muted">
          <Info className="size-4.5 shrink-0 text-cyan" />
          <span>{result.message}</span>
        </div>
      )}

      {/* 4. Attribute details breakdown */}
      {result.details && Object.keys(result.details).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-fg-faint">Identified Attributes</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(result.details).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-xl bg-white/[0.02] px-3.5 py-2.5 border border-white/4">
                <span className="text-xs capitalize text-fg-muted">{k.replace(/_/g, " ")}</span>
                <span className="text-xs font-semibold text-fg">{String(v ?? "—")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Confirmation Controls */}
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <GlassButton variant="ghost" onClick={onRetry}>Retake Photo</GlassButton>
        {result.verified ? (
          <GlassButton variant="success" onClick={onConfirm}>
            Log Taken <ChevronRight className="size-4" />
          </GlassButton>
        ) : (
          <GlassButton variant="danger" onClick={onConfirm}>
            Log Taken Anyway
          </GlassButton>
        )}
      </div>
    </div>
  );
}
