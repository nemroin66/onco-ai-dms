import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

type ButtonState = "idle" | "loading" | "success";

export interface AnimatedButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  loading?: boolean;
  success?: boolean;
  successDuration?: number;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<AnimatedButtonProps["variant"]>, string> = {
  primary: "bg-natural-accent hover:bg-natural-accent-dark text-theme-on-accent border-transparent",
  secondary: "bg-theme-surface dark:bg-natural-card hover:bg-slate-50 dark:hover:bg-natural-hover text-slate-700 border-natural-border dark:border-natural-border",
  danger: "bg-rose-600 hover:bg-rose-700 text-theme-on-accent border-transparent",
  ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-natural-hover text-slate-700 border-transparent",
};
const SIZE_CLASSES: Record<NonNullable<AnimatedButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export function AnimatedButton({
  onClick,
  loading = false,
  success = false,
  successDuration = 1100,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...rest
}: AnimatedButtonProps) {
  const [internalState, setInternalState] = useState<ButtonState>("idle");
  const isControlled = loading || success;
  const state: ButtonState = isControlled
    ? loading
      ? "loading"
      : "success"
    : internalState;
  const inFlight = useRef(false);

  const triggerClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick || inFlight.current) return;
    inFlight.current = true;
    setInternalState("loading");
    try {
      await onClick(e);
      setInternalState("success");
      setTimeout(() => {
        setInternalState("idle");
        inFlight.current = false;
      }, successDuration);
    } catch (err) {
      setInternalState("idle");
      inFlight.current = false;
      throw err;
    }
  };

  useEffect(() => {
    if (loading) setInternalState("loading");
    if (success) setInternalState("success");
  }, [loading, success]);

  const isDisabled = disabled || state === "loading";

  return (
    <button
      {...rest}
      data-state={state}
      disabled={isDisabled}
      onClick={triggerClick}
      className={`btn-morph hover-lift press-press font-semibold rounded-xl border ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      <span className="btn-content">{children}</span>
      <span className="btn-spinner" aria-hidden>
        <span className="btn-spinner-circle" />
      </span>
      <span className="btn-check" aria-hidden>
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    </button>
  );
}

export default AnimatedButton;
