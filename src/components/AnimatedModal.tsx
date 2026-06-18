import React, { useEffect, useRef } from "react";

export interface AnimatedModalProps {
  open: boolean;
  onClose: () => void;
  origin?: { x: number; y: number } | null;
  variant?: "scale-from-point" | "pop" | "fade";
  closeOnBackdrop?: boolean;
  backdropClassName?: string;
  modalClassName?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  open,
  onClose,
  origin = null,
  variant = "scale-from-point",
  closeOnBackdrop = true,
  backdropClassName = "",
  modalClassName = "",
  children,
  ariaLabel,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const originStyle: React.CSSProperties = origin
    ? ({
        ["--mx" as any]: `${origin.x}px`,
        ["--my" as any]: `${origin.y}px`,
      } as React.CSSProperties)
    : {};

  const variantClass = variant === "scale-from-point" ? "modal-scale-from-point" : variant === "pop" ? "modal-pop" : "modal-pop";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${backdropClassName}`}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/40 fade-in" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`relative z-10 ${variantClass} ${modalClassName}`}
        style={originStyle}
      >
        {children}
      </div>
    </div>
  );
};

export default AnimatedModal;
