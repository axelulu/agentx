interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogo({ size = 20, className }: AppLogoProps) {
  const id = "app-logo-" + Math.random().toString(36).slice(2, 6);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#181f30" />
          <stop offset="100%" stopColor="#0c1019" />
        </linearGradient>
        <linearGradient id={`${id}-x`} x1="0.15" y1="0.15" x2="0.85" y2="0.85">
          <stop offset="0%" stopColor="#4d90ff" />
          <stop offset="100%" stopColor="#8257f5" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect x="100" y="100" width="824" height="824" rx="184" ry="184" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="100" y="100" width="824" height="824" fill={`url(#${id}-bg)`} />
      </g>
      <rect
        x="101"
        y="101"
        width="822"
        height="822"
        rx="183.5"
        ry="183.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.08"
        strokeWidth="0.75"
      />
      <line
        x1="352"
        y1="352"
        x2="672"
        y2="672"
        stroke={`url(#${id}-x)`}
        strokeWidth="76"
        strokeLinecap="round"
      />
      <line
        x1="672"
        y1="352"
        x2="352"
        y2="672"
        stroke={`url(#${id}-x)`}
        strokeWidth="76"
        strokeLinecap="round"
      />
    </svg>
  );
}
