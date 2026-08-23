import { useLocation } from "react-router-dom";
import { formatClock, formatLongDate, greeting } from "@/lib/utils";
import { useMedications } from "@/hooks/useMedications";
import { AegisLogo } from "../ui/AegisLogo";
import { StatusDot } from "../ui/StatusDot";
import { NAV_ITEMS } from "./nav-items";

export function TopHeader() {
  const { now, online } = useMedications();
  const loc = useLocation();
  const title = NAV_ITEMS.find((n) => n.path === loc.pathname)?.label ?? "Aegis AI";

  return (
    <header className="glass-strong border-b border-white/8 px-6 py-4 backdrop-blur-3xl lg:border-none lg:bg-transparent lg:px-8 lg:py-6 safe-t">
      <div className="flex items-center justify-between">
        {/* mobile banner logo */}
        <div className="flex items-center gap-3 lg:hidden">
          <AegisLogo size={30} />
          <span className="font-semibold text-fg">Aegis AI</span>
          <span className="h-4 w-px bg-white/10" />
          <StatusDot online={online} />
        </div>

        {/* desktop banner details */}
        <div className="hidden lg:block">
          <p className="text-[11px] font-medium uppercase tracking-wider text-fg-faint">
            {greeting(now)} — {formatLongDate(now)}
          </p>
          <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-fg">{title}</h2>
        </div>

        <div className="num text-xs font-semibold text-cyan">
          {formatClock(now)}
        </div>
      </div>
    </header>
  );
}
