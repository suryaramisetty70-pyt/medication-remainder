import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AegisLogo } from "../ui/AegisLogo";
import { StatusDot } from "../ui/StatusDot";
import { useMedications } from "@/hooks/useMedications";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ className }: { className?: string }) {
  const { online } = useMedications();
  return (
    <aside className={cn(
      "glass-strong flex w-64 flex-col border-r border-white/10 p-6 backdrop-blur-3xl",
      className,
    )}>
      <div className="flex items-center gap-3">
        <AegisLogo size={36} />
        <div>
          <h1 className="text-base font-semibold tracking-tight text-fg">Aegis AI</h1>
          <p className="text-[10px] uppercase tracking-widest text-fg-faint">Smart Assistant</p>
        </div>
      </div>

      <nav className="mt-8 flex-1 space-y-1.5" aria-label="Main Navigation">
        {NAV_ITEMS.map(({ label, path, Icon }) => (
          <NavLink
            key={path} to={path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium",
              "transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:bg-white/5",
              isActive
                ? "bg-cyan/10 border-cyan/20 text-cyan shadow-glow-cyan"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <footer className="border-t border-white/8 pt-4">
        <StatusDot online={online} />
      </footer>
    </aside>
  );
}
