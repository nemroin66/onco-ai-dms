import React, { useEffect, useState } from "react";

export interface ProgressBarProps {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  variant?: "primary" | "success" | "danger" | "warning";
  showLabel?: boolean;
  striped?: boolean;
  height?: number;
  className?: string;
}

const COLOR_CLASSES: Record<NonNullable<ProgressBarProps["variant"]>, string> = {
  primary: "bg-natural-accent",
  success: "bg-emerald-500",
  danger: "bg-rose-500",
  warning: "bg-amber-500",
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  indeterminate = false,
  variant = "primary",
  showLabel = false,
  striped = false,
  height = 8,
  className = "",
}) => {
  const [displayedValue, setDisplayedValue] = useState(0);

  useEffect(() => {
    if (indeterminate) return;
    let raf = 0;
    const start = displayedValue;
    const target = Math.max(0, Math.min(value, max));
    const startTime = performance.now();
    const duration = 600;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedValue(start + (target - start) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, max, indeterminate]);

  if (indeterminate) {
    return (
      <div className={`progress-indeterminate ${className}`} style={{ height }}>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  const pct = (displayedValue / max) * 100;
  return (
    <div className={className}>
      {showLabel && (
        <div className="eyebrow flex justify-between items-center mb-1.5 text-slate-500">
          <span>Progress</span>
          <span className="text-slate-700 dark:text-slate-200">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        className="w-full bg-slate-200/70 dark:bg-slate-700/60 rounded-full overflow-hidden"
        style={{ height }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`${COLOR_CLASSES[variant]} h-full rounded-full progress-fill-anim ${striped ? "progress-striped" : ""}`}
          style={{ width: `${pct}%`, transition: "width 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
