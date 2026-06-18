import React, { useEffect, useState, useCallback, useRef } from "react";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";

type DialogVariant = "info" | "success" | "warning" | "danger";
type DialogKind = "alert" | "confirm";

interface DialogRequest {
  id: string;
  kind: DialogKind;
  title: string;
  message: string;
  variant: DialogVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: boolean) => void;
}

interface ToastItem {
  id: string;
  title: string;
  message: string;
  variant: DialogVariant;
  leaving: boolean;
}

type DialogEvent = CustomEvent<Omit<DialogRequest, "id">>;

const emitDialog = (request: Omit<DialogRequest, "id">) => {
  window.dispatchEvent(new CustomEvent("oncodb-dialog", { detail: request }));
};

export const notify = (message: string, title = "Notification", variant: DialogVariant = "info") => {
  return new Promise<void>((resolve) => {
    emitDialog({
      kind: "alert",
      title,
      message,
      variant,
      confirmLabel: "OK",
      resolve: () => resolve(),
    });
  });
};

export const confirmDialog = (
  message: string,
  title = "Confirm Action",
  variant: DialogVariant = "warning",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel"
) => {
  return new Promise<boolean>((resolve) => {
    emitDialog({
      kind: "confirm",
      title,
      message,
      variant,
      confirmLabel,
      cancelLabel,
      resolve,
    });
  });
};

const toastIcon: Record<DialogVariant, React.ReactNode> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  danger: <AlertTriangle className="h-4 w-4" />,
};

const toastBg: Record<DialogVariant, string> = {
  info: "bg-white dark:bg-slate-800 border-natural-accent/40 text-natural-accent shadow-md",
  success: "bg-white dark:bg-slate-800 border-emerald-400/60 text-emerald-700 dark:text-emerald-300 shadow-md",
  warning: "bg-white dark:bg-slate-800 border-amber-400/60 text-amber-700 dark:text-amber-300 shadow-md",
  danger: "bg-white dark:bg-slate-800 border-rose-400/60 text-rose-700 dark:text-rose-300 shadow-md",
};

const confirmIcon: Record<DialogVariant, React.ReactNode> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  danger: <AlertTriangle className="h-4 w-4" />,
};

const confirmTone: Record<DialogVariant, string> = {
  info: "text-natural-accent bg-natural-accent/10 border-natural-accent/25",
  success: "text-emerald-700 bg-emerald-500/10 border-emerald-500/25",
  warning: "text-amber-700 bg-amber-500/10 border-amber-500/25",
  danger: "text-rose-700 bg-rose-500/10 border-rose-500/25",
};

const confirmBtn: Record<DialogVariant, string> = {
  info: "bg-natural-accent hover:bg-natural-accent text-white",
  success: "bg-emerald-700 hover:bg-emerald-800 text-white",
  warning: "bg-amber-700 hover:bg-amber-800 text-white",
  danger: "bg-rose-700 hover:bg-rose-800 text-white",
};

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmReq, setConfirmReq] = useState<DialogRequest | null>(null);
  const toastIdRef = useRef(0);

  const addToast = useCallback((title: string, message: string, variant: DialogVariant) => {
    const id = `toast_${++toastIdRef.current}`;
    setToasts((prev) => [...prev, { id, title, message, variant, leaving: false }]);
    // auto-dismiss after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 200);
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  useEffect(() => {
    const onDialog = (event: Event) => {
      const detail = (event as DialogEvent).detail;
      if (detail.kind === "alert") {
        addToast(detail.title, detail.message, detail.variant);
        detail.resolve(true);
      } else {
        setConfirmReq({
          ...detail,
          id: `confirm_${Date.now()}`,
        });
      }
    };
    window.addEventListener("oncodb-dialog", onDialog);
    return () => window.removeEventListener("oncodb-dialog", onDialog);
  }, [addToast]);

  const closeConfirm = (value: boolean) => {
    if (!confirmReq) return;
    confirmReq.resolve(value);
    setConfirmReq(null);
  };

  return (
    <>
      {children}

      {/* Toast stack — top-right */}
      <div className="fixed top-3 right-3 z-[100] flex flex-col gap-1.5 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-3 py-2.5 rounded-lg border shadow-md min-w-[220px] max-w-[350px] ${toastBg[t.variant]} ${
              t.leaving ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"
            } transition-all duration-200`}
          >
            <span className="mt-0.5 flex-shrink-0">{toastIcon[t.variant]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold leading-tight truncate">{t.title}</p>
              <p className="text-[11px] leading-tight mt-0.5 opacity-80 line-clamp-2">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="p-0.5 rounded flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm dialog — compact overlay, no backdrop */}
      {confirmReq && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] pointer-events-none">
          <div className="pointer-events-auto theme-dialog-shadow w-full max-w-xs rounded-xl bg-natural-bg dark:bg-slate-900 border border-natural-border dark:border-slate-700 overflow-hidden premium-dialog-in">
            <div className="p-3.5 flex items-start gap-2.5">
              <div className={`h-7 w-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${confirmTone[confirmReq.variant]}`}>
                {confirmIcon[confirmReq.variant]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-850 dark:text-theme-on-accent">{confirmReq.title}</h3>
                  <button
                    type="button"
                    onClick={() => closeConfirm(false)}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-theme-on-accent hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-250">{confirmReq.message}</p>
              </div>
            </div>
            <div className="px-3.5 py-2.5 bg-theme-surface dark:bg-slate-950 border-t border-natural-border/70 dark:border-slate-800 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-natural-border dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-250 hover:bg-theme-surface dark:hover:bg-slate-800"
              >
                {confirmReq.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${confirmBtn[confirmReq.variant]}`}
              >
                {confirmReq.confirmLabel || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
