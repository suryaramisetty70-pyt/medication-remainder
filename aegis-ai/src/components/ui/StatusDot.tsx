import { cn } from "@/lib/utils";

export function StatusDot({ online, label }: { online: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-medium">
      <span className="relative flex size-2">
        <span className={cn("absolute inset-0 rounded-full status-ping", online ? "bg-emerald" : "bg-danger")} />
        <span className={cn("relative size-2 rounded-full", online ? "bg-emerald" : "bg-danger")} />
      </span>
      <span className={online ? "text-emerald" : "text-danger"}>{label ?? (online ? "Connected" : "Offline")}</span>
    </span>
  );
}
