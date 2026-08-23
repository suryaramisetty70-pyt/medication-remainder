import { WifiOff, RefreshCw } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { GlassButton } from "../ui/GlassButton";

interface Props {
  message?: string | null;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl border border-danger/20 bg-danger/10 text-danger">
        <WifiOff className="size-8" />
      </div>
      <h3 className="mt-6 text-lg font-bold tracking-tight text-fg font-sans">Unable to connect to Aegis AI</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
        {message || "We couldn't connect to the backend server. Please verify the API server is active and running."}
      </p>
      <GlassButton variant="default" className="mt-8" onClick={onRetry}>
        <RefreshCw className="size-4" /> Retry Connection
      </GlassButton>
    </GlassCard>
  );
}
