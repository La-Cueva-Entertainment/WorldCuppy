export function SoccerFieldBanner({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 260"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      {/* Field base */}
      <rect x="0" y="0" width="1200" height="260" fill="currentColor" opacity="0.42" />

      {/* Stripes */}
      {Array.from({ length: 12 }).map((_, i) => {
        const x = (1200 / 12) * i;
        const w = 1200 / 12;
        const opacity = i % 2 === 0 ? 0.22 : 0.12;
        return (
          <rect
            key={i}
            x={x}
            y="0"
            width={w}
            height="260"
            fill="currentColor"
            opacity={opacity}
          />
        );
      })}

      {/* Pitch lines */}
      <g opacity="0.9" stroke="white" strokeWidth="3" fill="none">
        {/* Halfway line */}
        <line x1="600" y1="18" x2="600" y2="242" />

        {/* Center circle */}
        <circle cx="600" cy="130" r="58" />
        <circle cx="600" cy="130" r="3" fill="white" stroke="none" />
      </g>

      {/* Sunlight + subtle vignette for readability */}
      <defs>
        <linearGradient id="fieldSun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="40%" stopColor="white" stopOpacity="0.12" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fieldFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="black" stopOpacity="0.12" />
          <stop offset="45%" stopColor="black" stopOpacity="0.06" />
          <stop offset="100%" stopColor="black" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="260" fill="url(#fieldSun)" />
      <rect x="0" y="0" width="1200" height="260" fill="url(#fieldFade)" />
    </svg>
  );
}
