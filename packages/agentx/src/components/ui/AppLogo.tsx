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
        <clipPath id={`${id}-clip`}>
          <rect x="100" y="100" width="824" height="824" rx="184" ry="184" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="100" y="100" width="824" height="824" fill="#111117" />
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
        strokeOpacity="0.06"
        strokeWidth="0.75"
      />
      <path
        d="M 332 345 H 692 Q 764 345 764 417 V 573 Q 764 645 692 645 H 385 L 300 680 L 332 645 Q 260 645 260 573 V 417 Q 260 345 332 345 Z"
        fill="#ffffff"
      />
    </svg>
  );
}
