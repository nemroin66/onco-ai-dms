import React, { useEffect, useState } from "react";
import AnimatedLogo from "./AnimatedLogo";

export interface HeroIntroProps {
  appName: string;
  tagline?: string;
  duration?: number;
  onDone?: () => void;
}

export const HeroIntro: React.FC<HeroIntroProps> = ({ appName, tagline, duration = 1500, onDone }) => {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), duration - 320);
    const doneTimer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, duration);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [duration, onDone]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-natural-bg dark:bg-slate-900 transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="mb-6">
        <AnimatedLogo size={120} loop />
      </div>
      <h1 className="hero-fade-up text-3xl md:text-4xl font-bold tracking-tight text-slate-800 dark:text-theme-on-accent" style={{ animationDelay: "0.4s" }}>
        {appName}
      </h1>
      {tagline && (
        <p className="hero-fade-up mt-2 text-sm text-slate-500 dark:text-slate-400" style={{ animationDelay: "0.6s" }}>
          {tagline}
        </p>
      )}
      <div className="hero-fade-up mt-8 w-48" style={{ animationDelay: "0.9s" }}>
        <div className="progress-indeterminate" style={{ height: 4 }} />
      </div>
    </div>
  );
};

export default HeroIntro;
