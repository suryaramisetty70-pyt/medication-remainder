import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "success" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  default: "bg-white/5 border-white/10 text-fg hover:bg-white/10 hover:border-white/20",
  primary: "bg-cyan/15 border-cyan/35 text-cyan hover:bg-cyan/25 hover:shadow-glow-cyan",
  success: "bg-emerald/15 border-emerald/35 text-emerald hover:bg-emerald/25 hover:shadow-glow-emerald",
  danger: "bg-danger/12 border-danger/30 text-danger hover:bg-danger/20",
  ghost: "bg-transparent border-transparent text-fg-muted hover:text-fg hover:bg-white/5",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-xs gap-1.5 rounded-xl",
  md: "h-11 px-4 text-sm gap-2 rounded-2xl",
  lg: "h-12 px-5 text-sm gap-2 rounded-2xl",
};

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton({ className, variant = "default", size = "md", loading, disabled, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center border font-medium backdrop-blur-xl",
          "transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)]",
          "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]",
          "disabled:pointer-events-none disabled:opacity-45",
          VARIANTS[variant], SIZES[size], className,
        )}
        {...rest}
      >
        {loading && (
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);
