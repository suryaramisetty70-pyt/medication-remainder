import { GlassModal } from "../ui/GlassModal";
import { GlassButton } from "../ui/GlassButton";
import { ScannerFrame } from "./ScannerFrame";
import { VerificationResult } from "./VerificationResult";
import { useScanner, VERIFY_STAGES } from "@/hooks/useScanner";

interface Props {
  open: boolean;
  onClose: () => void;
  medicationName: string;
  onVerifySuccess: () => Promise<void> | void;
}

export function ScannerModal({ open, onClose, medicationName, onVerifySuccess }: Props) {
  const {
    videoRef, phase, preview, stage, result, error,
    capture, acceptFile, retake, verify,
  } = useScanner(open);

  const handleConfirm = async () => {
    await onVerifySuccess();
    onClose();
  };

  const isScanning = phase === "starting" || phase === "live" || phase === "denied";
  const isPreview = phase === "preview";
  const isVerifying = phase === "verifying";
  const isResult = phase === "result";

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={isResult ? "Scan Result" : `Verify ${medicationName}`}
      subtitle={isScanning ? "Align the pill in the centre frame" : undefined}
      fullscreenOnMobile
      className="sm:max-w-md"
    >
      {/* 1. Capture and feed frame */}
      {isScanning && (
        <div className="space-y-4 p-5">
          <ScannerFrame
            videoRef={videoRef} phase={phase} preview={preview}
            onCapture={capture} onFileSelect={acceptFile}
          />
          {error && <p role="alert" className="text-xs text-danger text-center font-medium">{error}</p>}
        </div>
      )}

      {/* 2. Photo review and submission */}
      {isPreview && (
        <div className="space-y-5 p-5">
          <ScannerFrame
            videoRef={videoRef} phase={phase} preview={preview}
            onCapture={capture} onFileSelect={acceptFile}
          />
          {error && <p role="alert" className="text-xs text-danger text-center font-medium">{error}</p>}
          <div className="flex justify-end gap-2">
            <GlassButton variant="ghost" onClick={retake}>Retake</GlassButton>
            <GlassButton variant="primary" onClick={() => verify(medicationName)}>
              Verify Pill
            </GlassButton>
          </div>
        </div>
      )}

      {/* 3. AI Processing visual loading indicator */}
      {isVerifying && (
        <div className="flex flex-col items-center justify-center py-20 text-center p-5">
          <div className="relative flex size-14 items-center justify-center">
            {/* outer radar ring */}
            <span className="absolute inset-0 size-14 animate-ping rounded-full bg-cyan/15" />
            <span className="size-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          </div>
          <h3 className="mt-6 text-sm font-semibold tracking-wider text-cyan uppercase">Analyzing Pill Vision...</h3>
          
          <div className="mt-8 space-y-2.5 w-full max-w-xs">
            {VERIFY_STAGES.map((label, idx) => {
              const active = idx === stage;
              const done = idx < stage;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 text-xs font-semibold transition-all duration-500 ${
                    active ? "text-cyan opacity-100 scale-102" : done ? "text-emerald opacity-75" : "text-fg-faint opacity-45"
                  }`}
                >
                  <div className={`size-2.5 rounded-full border transition-colors ${
                    active ? "bg-cyan border-cyan shadow-glow-cyan" : done ? "bg-emerald border-emerald" : "bg-transparent border-white/20"
                  }`} />
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Display result card and logs options */}
      {isResult && result && (
        <VerificationResult
          result={result} medicationName={medicationName}
          onConfirm={handleConfirm} onRetry={retake}
        />
      )}
    </GlassModal>
  );
}
