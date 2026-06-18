import React from "react";

type TransitionVariant = "fade" | "slide-left" | "slide-right" | "scale" | "slide-up";

export interface PageTransitionProps {
  routeKey: string;
  variant?: TransitionVariant;
  className?: string;
  children: React.ReactNode;
}

const VARIANT_CLASS: Record<TransitionVariant, string> = {
  fade: "page-fade-in",
  "slide-left": "page-slide-left",
  "slide-right": "page-slide-right",
  scale: "page-scale-in",
  "slide-up": "fade-in-up",
};

export const PageTransition: React.FC<PageTransitionProps> = ({ routeKey, variant = "fade", className = "", children }) => {
  return (
    <div key={routeKey} className={`${VARIANT_CLASS[variant]} ${className}`}>
      {children}
    </div>
  );
};

export default PageTransition;
