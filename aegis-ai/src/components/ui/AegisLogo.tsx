export function AegisLogo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Aegis AI">
      <defs>
        <linearGradient id="ag-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="ag-core">
          <stop offset="0%" stopColor="#e6feff" />
          <stop offset="55%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M20 2.6 34.4 7.7v11.1c0 8.6-5.7 15.5-14.4 18.6C11.3 34.3 5.6 27.4 5.6 18.8V7.7Z"
        fill="none" stroke="url(#ag-shield)" strokeWidth="1.6" strokeLinejoin="round"
      />
      <path d="M20 7 29.4 10.4v8.3c0 5.9-3.8 10.6-9.4 12.9-5.6-2.3-9.4-7-9.4-12.9v-8.3Z"
        fill="rgb(34 211 238 / 0.06)" stroke="rgb(34 211 238 / 0.25)" strokeWidth="0.8" />
      <ellipse cx="20" cy="19.4" rx="7.4" ry="3" fill="none" stroke="rgb(45 212 191 / 0.5)" strokeWidth="0.7" />
      <ellipse cx="20" cy="19.4" rx="3" ry="7.4" fill="none" stroke="rgb(34 211 238 / 0.35)" strokeWidth="0.7" />
      <circle cx="20" cy="19.4" r="6" fill="url(#ag-core)" opacity="0.75" />
      <circle cx="20" cy="19.4" r="2.1" fill="#e6feff" />
    </svg>
  );
}
