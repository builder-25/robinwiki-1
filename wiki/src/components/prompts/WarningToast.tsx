"use client";
import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WarningToastProps {
  warnings: string[];
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function WarningToast({
  warnings,
  onDismiss,
  autoDismissMs = 6000,
}: WarningToastProps) {
  useEffect(() => {
    if (warnings.length === 0) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [warnings, autoDismissMs, onDismiss]);

  if (warnings.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-1/2 z-[300] w-[min(420px,90vw)] -translate-x-1/2",
        "rounded-lg border border-yellow-500/40 bg-yellow-50 px-4 py-3 shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-700" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-900">Saved with warnings</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-yellow-800">
            {warnings.map((w, i) => (
              <li key={`${i}-${w.slice(0, 24)}`}>{w}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 text-yellow-800 hover:bg-yellow-100"
          aria-label="Dismiss"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
