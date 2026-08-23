import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function MobileNav({ className }: { className?: string }) {
  // slice to 5 items on mobile to avoid overcrowding
  const visible = NAV_ITEMS.slice(0, 5);

  return (
    <nav
      aria-label="Mobile Navigation"
      className={cn(
        "glass-strong fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 px-4 py-2 backdrop-blur-3xl safe-b",
        className,
      )}
    >
      <div className="flex items-center justify-around gap-1">
        {visible.map(({ label, path, Icon }) => (
          <NavLink
            key={path} to={path}
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium",
              "transition-all duration-300",
              isActive
                ? "text-cyan"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon className="size-4.5" />
            <span>{label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
