import React from "react";

export interface HamburgerButtonProps {
  open: boolean;
  onToggle: () => void;
  className?: string;
  ariaLabel?: string;
}

export const HamburgerButton: React.FC<HamburgerButtonProps> = ({ open, onToggle, className = "", ariaLabel = "Toggle menu" }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={ariaLabel}
    aria-expanded={open}
    className={`hamburger-btn hover-scale ${className}`}
    data-open={open ? "true" : "false"}
  >
    <span />
    <span />
    <span />
  </button>
);

export default HamburgerButton;
