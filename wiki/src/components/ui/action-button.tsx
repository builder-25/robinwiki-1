"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type BaseButtonProps = React.ComponentProps<typeof Button>;

export interface ActionButtonProps extends BaseButtonProps {
  /** Show a spinner and disable the button. */
  loading?: boolean;
  /** Position of the spinner when loading. Defaults to inline-start. */
  spinnerPosition?: "inline-start" | "inline-end";
  /** Optional leading icon (hidden while loading if spinner replaces it). */
  iconStart?: React.ReactNode;
  /** Optional trailing icon (hidden while loading if spinner replaces it). */
  iconEnd?: React.ReactNode;
  /**
   * Visual tone. `brand` uses the app's primary blue (#3366cc) with
   * a matching disabled treatment — matches the onboarding style.
   * Falls back to shadcn Button variants otherwise.
   */
  tone?: "brand" | "default";
}

const brandClasses =
  "rounded-none bg-[var(--wiki-link)] text-white hover:bg-[var(--wiki-link-hover)] disabled:bg-[var(--btn-disabled-bg)] disabled:text-[var(--btn-disabled-text)]";

export function ActionButton({
  loading = false,
  spinnerPosition = "inline-start",
  iconStart,
  iconEnd,
  tone = "brand",
  disabled,
  className,
  children,
  ...props
}: ActionButtonProps) {
  const isDisabled = disabled || loading;

  const startSlot =
    loading && spinnerPosition === "inline-start" ? (
      <Spinner data-icon="inline-start" />
    ) : iconStart ? (
      <span data-icon="inline-start" className="inline-flex">
        {iconStart}
      </span>
    ) : null;

  const endSlot =
    loading && spinnerPosition === "inline-end" ? (
      <Spinner data-icon="inline-end" />
    ) : iconEnd ? (
      <span data-icon="inline-end" className="inline-flex">
        {iconEnd}
      </span>
    ) : null;

  return (
    <Button
      disabled={isDisabled}
      className={cn(tone === "brand" && brandClasses, className)}
      {...props}
    >
      {startSlot}
      {children}
      {endSlot}
    </Button>
  );
}
