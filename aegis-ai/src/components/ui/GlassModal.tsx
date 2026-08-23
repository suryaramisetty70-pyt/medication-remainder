import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  fullscreenOnMobile?: boolean;
  className?: string;
}

export function GlassModal({ open, onClose, title, subtitle, children, fullscreenOnMobile, className }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const nodes = panel.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      restore.current?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-obsidian/80 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "glass-strong relative z-10 flex w-full flex-col overflow-hidden",
              fullscreenOnMobile
                ? "h-[100dvh] rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-3xl"
                : "max-h-[92dvh] rounded-t-3xl sm:max-w-lg sm:rounded-3xl",
              className,
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4 safe-t">
              <div>
                <h2 className="text-base font-semibold tracking-tight">{title}</h2>
                {subtitle && <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>}
              </div>
              <button
                onClick={onClose} aria-label="Close dialog"
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-fg-muted transition hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto scroll-none">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
