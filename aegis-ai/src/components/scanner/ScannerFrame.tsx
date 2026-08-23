import { useRef, type ChangeEvent } from "react";
import { Camera, Image, CircleAlert } from "lucide-react";
import { GlassButton } from "../ui/GlassButton";
import type { ScannerPhase } from "@/hooks/useScanner";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  phase: ScannerPhase;
  preview: string | null;
  onCapture: () => void;
  onFileSelect: (file: File) => void;
}

export function ScannerFrame({ videoRef, phase, preview, onCapture, onFileSelect }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileSelect(f);
  };

  return (
    <div className="relative aspect-square w-full overflow-hidden border-y border-white/8 bg-obsidian-2 sm:rounded-2xl sm:border">
      {/* 1. Camera Live feed */}
      {(phase === "starting" || phase === "live") && (
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover scale-x-[-1]"
        />
      )}

      {/* 2. Photo preview (after capture or upload) */}
      {preview && (
        <img
          src={preview}
          alt="Dose verify scan capture preview"
          className="h-full w-full object-cover"
        />
      )}

      {/* 3. Initializing spinner state */}
      {phase === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-obsidian-2/70 backdrop-blur-sm">
          <span className="size-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <p className="text-xs text-cyan tracking-wider uppercase font-semibold">Activating Camera...</p>
        </div>
      )}

      {/* 4. Camera access denied status */}
      {phase === "denied" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <CircleAlert className="size-10 text-fg-faint" />
          <h4 className="mt-4 text-sm font-semibold text-fg">Camera access unavailable</h4>
          <p className="mt-1.5 max-w-xs text-xs text-fg-muted">
            Aegis was not granted permission, or your browser does not support camera capture. Please upload a photo instead.
          </p>
        </div>
      )}

      {/* Overlay guide line for pill placement */}
      {phase === "live" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* subtle white/gray clinical crosshair guide */}
          <div className="size-52 rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.01]" />
        </div>
      )}

      {/* Mobile-friendly overlay bottom floating controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
        {phase === "live" && (
          <GlassButton variant="success" className="rounded-full shadow-lg" onClick={onCapture}>
            <Camera className="size-4" /> Capture Photo
          </GlassButton>
        )}
        {(phase === "live" || phase === "denied") && (
          <>
            <GlassButton
              variant="default" className="rounded-full shadow-lg"
              onClick={() => fileInput.current?.click()}
            >
              <Image className="size-4" /> Choose File
            </GlassButton>
            <input
              ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFile}
            />
          </>
        )}
      </div>
    </div>
  );
}
