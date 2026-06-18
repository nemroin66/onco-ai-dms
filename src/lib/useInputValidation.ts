import React, { useCallback, useRef, useState } from "react";

export interface UseInputValidationReturn {
  ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
  triggerError: () => void;
  triggerSuccess: () => void;
  triggerFlash: () => void;
}

export function useInputValidation(): UseInputValidationReturn {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const [, force] = useState(0);

  const triggerError = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.classList.remove("input-shake", "input-flash");
    void node.offsetWidth;
    node.classList.add("input-shake");
    setTimeout(() => node.classList.remove("input-shake"), 540);
    force((v) => v + 1);
  }, []);

  const triggerSuccess = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.classList.remove("input-shake", "input-flash");
    void node.offsetWidth;
    node.classList.add("input-flash");
    setTimeout(() => node.classList.remove("input-flash"), 640);
    force((v) => v + 1);
  }, []);

  const triggerFlash = triggerSuccess;

  return { ref, triggerError, triggerSuccess, triggerFlash };
}

export function flashInputError(node: HTMLElement | null) {
  if (!node) return;
  node.classList.remove("input-shake", "input-flash");
  void node.offsetWidth;
  node.classList.add("input-shake");
  setTimeout(() => node.classList.remove("input-shake"), 540);
}

export default useInputValidation;
