export function SoccerBallIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ballGrad" cx="38%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cccccc" />
        </radialGradient>
        <clipPath id="circle">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>

      {/* Base ball */}
      <circle cx="50" cy="50" r="48" fill="url(#ballGrad)" stroke="#333" strokeWidth="2" />

      {/* Black patches — classic soccer ball pattern */}
      <g fill="#1a1a1a" clipPath="url(#circle)">
        {/* Center pentagon */}
        <polygon points="50,28 62,37 58,51 42,51 38,37" />
        {/* Top left */}
        <polygon points="28,18 40,20 38,35 24,36 18,26" />
        {/* Top right */}
        <polygon points="72,18 82,26 76,36 62,35 60,20" />
        {/* Left */}
        <polygon points="14,46 24,38 36,53 28,64 14,60" />
        {/* Right */}
        <polygon points="86,46 86,60 72,64 64,53 76,38" />
        {/* Bottom left */}
        <polygon points="22,72 30,64 44,69 42,82 28,84" />
        {/* Bottom right */}
        <polygon points="78,72 72,84 58,82 56,69 70,64" />
        {/* Bottom center */}
        <polygon points="50,74 58,68 64,78 50,88 36,78 42,68" />
      </g>

      {/* Shine */}
      <ellipse cx="36" cy="32" rx="10" ry="6" fill="white" opacity="0.35" transform="rotate(-30 36 32)" />
    </svg>
  );
}
