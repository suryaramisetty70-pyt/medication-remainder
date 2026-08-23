import { forwardRef, useCallback, type HTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsTouch } from "@/hooks/useReducedMotion";

type Props = HTMLMotionProps<"div"> & {
  strong?: boolean;
  interactive?: boolean;
} & Pick<HTMLAttributes<HTMLDivElement>, "role">;

export const GlassCard = forwardRef<HTMLDivElement, Props>(function GlassCard(
  { className, strong, interactive = true, children, ...rest }, ref,
) {
  const touch = useIsTouch();

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (touch) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, [touch]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={interactive ? onMove : undefined}
      className={cn(
        "rounded-2xl p-5 sm:p-6",
        strong ? "glass-strong" : "glass",
        interactive && "transition-all duration-300 hover:border-white/18 hover:bg-white/[0.045] hover:-translate-y-0.5",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
});
