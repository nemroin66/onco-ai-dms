import React from "react";

export interface AnimatedLogoProps {
  size?: number;
  className?: string;
  title?: string;
  loop?: boolean;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ size = 36, className = "", title = "Oncology Data Manager", loop = false }) => {
  const loopClass = loop ? "infinite" : "forwards";
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--theme-accent)" />
          <stop offset="100%" stopColor="var(--theme-brown)" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        stroke="url(#logoGrad)"
        strokeWidth="2.5"
        className="svg-draw"
        style={{ ["--draw-len" as any]: 180, animationIterationCount: loopClass } as React.CSSProperties}
      />
      <path
        d="M 20 32 L 28 40 L 44 24"
        fill="none"
        stroke="url(#logoGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="svg-draw"
        style={{ ["--draw-len" as any]: 60, animationDelay: "0.6s", animationIterationCount: loopClass } as React.CSSProperties}
      />
      <circle cx="32" cy="32" r="2.5" fill="url(#logoGrad)" className="svg-fill-in bounce-in" style={{ animationDelay: "1.2s" }} />
    </svg>
  );
};

export default AnimatedLogo;
