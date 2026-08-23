import { Check, Clock, CircleAlert, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DoseStatus } from "@/types/logs";

const MAP: Record<DoseStatus, { label: string; cls: string; Icon: LucideIcon }> = {
  taken:    { label: "Taken",    cls: "text-emerald bg-emerald/12 border-emerald/30", Icon: Check },
  missed:   { label: "Missed",   cls: "text-danger bg-danger/12 border-danger/30",    Icon: X },
  pending:  { label: "Pending",  cls: "text-fg-muted bg-white/5 border-white/12",     Icon: Clock },
  upcoming: { label: "Upcoming", cls: "text-cyan bg-cyan/10 border-cyan/25",          Icon: Clock },
};

export function GlassBadge({ status, className }: { status: DoseStatus; className?: string }) {
  const { label, cls, Icon } = MAP[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
      "transition-colors duration-500", cls, className,
    )}>
      {/* icon + text: status is never colour-only */}
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

export function WarningBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/12 px-2.5 py-1 text-[11px] font-medium text-amber">
      <CircleAlert className="size-3" aria-hidden />{children}
    </span>
  );
}
