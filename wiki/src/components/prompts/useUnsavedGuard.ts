"use client";
import { useEffect } from "react";

/**
 * Installs a beforeunload handler while `isDirty` is true. Browsers show a
 * native "Leave site?" prompt for any tab close / reload / full navigation.
 *
 * Note: Next.js App Router SPA navigations (Link, router.push) do NOT fire
 * beforeunload. Intra-app protection lives in onClose intercept + per-page
 * route guards (deferred to a future phase).
 */
export function useUnsavedGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
