import { useEffect, useRef } from "react";
import { useIsTouch, useReducedMotion } from "./useReducedMotion";

export interface PointerRef { x: number; y: number }

/** Ref-based so pointer movement never triggers React rerenders. */
export function usePointer() {
  const pointer = useRef<PointerRef>({ x: 0, y: 0 });
  const reduced = useReducedMotion();
  const touch = useIsTouch();

  useEffect(() => {
    if (reduced) return;

    const set = (cx: number, cy: number) => {
      pointer.current.x = (cx / window.innerWidth) * 2 - 1;
      pointer.current.y = (cy / window.innerHeight) * 2 - 1;
      document.documentElement.style.setProperty("--px", pointer.current.x.toFixed(3));
      document.documentElement.style.setProperty("--py", pointer.current.y.toFixed(3));
    };

    const onMouse = (e: MouseEvent) => set(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) set(t.clientX, t.clientY); // passive: never blocks scroll
    };

    if (touch) window.addEventListener("touchmove", onTouch, { passive: true });
    else window.addEventListener("mousemove", onMouse, { passive: true });

    return () => {
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("mousemove", onMouse);
    };
  }, [reduced, touch]);

  return pointer;
}
