"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DestructiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export default function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmLabel,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const canConfirm = typed === confirmText;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-1">
          <label
            htmlFor="destructive-confirm-input"
            className="text-sm text-muted-foreground"
          >
            Type <span className="font-semibold text-foreground">{confirmText}</span> to confirm.
          </label>
          <Input
            id="destructive-confirm-input"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmText}
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm();
              setTyped("");
              onOpenChange(false);
            }}
            className={cn(
              "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              !canConfirm && "opacity-50 cursor-not-allowed",
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
