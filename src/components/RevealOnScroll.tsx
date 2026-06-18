import React, { useEffect, useRef, useState } from "react";

export interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
  variant?: "up" | "scale";
  delay?: number;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
}

export const RevealOnScroll: React.FC<RevealOnScrollProps> = ({
  children,
  className = "",
  variant = "up",
  delay = 0,
  threshold = 0.12,
  rootMargin = "0px 0px -10% 0px",
  once = true,
  as: Tag = "div",
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold, rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  const baseClass = variant === "up" ? "reveal-on-scroll" : "reveal-on-scroll-scale";
  const style: React.CSSProperties = delay ? { transitionDelay: `${delay}ms` } : {};

  return React.createElement(
    Tag,
    { ref, className: `${baseClass} ${visible ? "is-visible" : ""} ${className}`.trim(), style },
    children
  );
};

export default RevealOnScroll;
