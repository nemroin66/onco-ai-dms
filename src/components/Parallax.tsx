import React, { useEffect, useRef, useState } from "react";

export interface ParallaxProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export const Parallax: React.FC<ParallaxProps> = ({ children, speed = 0.3, className = "" }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      const viewH = window.innerHeight;
      const center = rect.top + rect.height / 2 - viewH / 2;
      setOffset(-center * speed);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [speed]);

  return (
    <div ref={ref} className={className} style={{ transform: `translate3d(0, ${offset.toFixed(2)}px, 0)`, willChange: "transform" }}>
      {children}
    </div>
  );
};

export default Parallax;
