"use client";
import { AlertCircle } from "lucide-react";
import type { ApiErrorBody } from "./types";
import { describeSaveError } from "./errorMessages";
import { cn } from "@/lib/utils";

export interface ValidationBannerProps {
  error: ApiErrorBody | null;
  className?: string;
}

export default function ValidationBanner({ error, className }: ValidationBannerProps) {
  if (!error) return null;
  const message = describeSaveError(error);
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-destructive">{message}</p>
        {error.code ? (
          <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">
            {error.code}
          </p>
        ) : null}
      </div>
    </div>
  );
}
