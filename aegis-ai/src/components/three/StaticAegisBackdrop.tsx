import { usePointer } from "@/hooks/usePointer";

export function StaticAegisBackdrop() {
  // pointer tracking continues so CSS spotlights on cards remain interactive
  usePointer();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-obsidian" aria-hidden>
      {/* high fidelity css lights that simulate the WebGL composition layout */}
      <div className="absolute top-[-25%] right-[-15%] size-[70vw] rounded-full bg-cyan/10 blur-[130px]" />
      <div className="absolute bottom-[-20%] left-[-10%] size-[60vw] rounded-full bg-teal/5 blur-[120px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian/45 via-obsidian/25 to-obsidian/70" />
    </div>
  );
}
