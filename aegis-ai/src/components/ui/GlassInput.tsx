import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-fg placeholder:text-fg-faint " +
  "backdrop-blur-xl outline-none transition-all duration-300 " +
  "focus:border-cyan/50 focus:bg-white/[0.06] focus:shadow-glow-cyan";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, FieldProps & React.InputHTMLAttributes<HTMLInputElement>>(
  function GlassInput({ label, error, hint, className, id, ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <div className="space-y-2">
        <label htmlFor={fieldId} className="block text-xs font-medium tracking-wide text-fg-muted">{label}</label>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined}
          className={cn(base, "h-12", error && "border-danger/60 focus:border-danger focus:shadow-none", className)}
          {...rest}
        />
        {error
          ? <p id={`${fieldId}-err`} role="alert" className="text-xs text-danger">{error}</p>
          : hint ? <p id={`${fieldId}-hint`} className="text-xs text-fg-faint">{hint}</p> : null}
      </div>
    );
  },
);

export const GlassTextarea = forwardRef<HTMLTextAreaElement, FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function GlassTextarea({ label, error, className, id, ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <div className="space-y-2">
        <label htmlFor={fieldId} className="block text-xs font-medium tracking-wide text-fg-muted">{label}</label>
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          className={cn(base, "min-h-24 resize-none py-3", error && "border-danger/60", className)}
          {...rest}
        />
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
    );
  },
);
