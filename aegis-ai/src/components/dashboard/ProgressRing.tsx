import { useCountUp } from "@/hooks/useCountUp";

interface Props {
  value: number; // 0..100
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function ProgressRing({ value, size = 160, strokeWidth = 14, label = "Adherence" }: Props) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const animated = useCountUp(value, 1200);
  const offset = circ - (animated / 100) * circ;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        {/* background track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="transparent" stroke="rgb(255 255 255 / 0.03)" strokeWidth={strokeWidth}
        />
        {/* filled progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="transparent"
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      {/* inner content centered */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-3xl font-extrabold tracking-tight text-fg">
          {Math.round(animated)}%
        </span>
        <span className="text-[10px] uppercase tracking-wider text-fg-faint">{label}</span>
      </div>
    </div>
  );
}
