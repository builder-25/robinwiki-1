"use client";
import { useEffect } from "react";
import { RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UndoToastProps {
  visible: boolean;
  label?: string;
  onUndo: () => void;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function UndoToast({
  visible,
  label = "Reset to default",
  onUndo,
  onDismiss,
  autoDismissMs = 10000,
}: UndoToastProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [visible, autoDismissMs, onDismiss]);

  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-1/2 z-[300] flex w-[min(360px,90vw)] -translate-x-1/2 items-center gap-3",
        "rounded-lg border border-foreground/10 bg-background px-3 py-2 shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
      )}
    >
      <span className="flex-1 text-sm">{label}</span>
      <Button type="button" variant="outline" size="sm" onClick={onUndo} className="gap-1.5">
        <RotateCcw className="size-3.5" aria-hidden />
        Undo
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
