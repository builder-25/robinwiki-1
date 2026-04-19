"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { T } from "@/lib/typography";
import ValidationBanner from "./ValidationBanner";
import { NETWORK_ERROR_MESSAGE } from "./errorMessages";
import type { ApiErrorBody } from "./types";

export interface PreviewPanelProps {
  /** Wiki-type slug (e.g. "log"). Used in the fetch URL. */
  slug: string;
  /** Current unsaved YAML from the editor. Captured at fetch time. */
  draftYaml: string;
  /** Monotonic counter. Incrementing it triggers a fresh fetch. Value 0 means "no preview requested yet" — do not fetch on mount. */
  triggerToken: number;
  /** Called when the user clicks the X button in the panel header. */
  onClose: () => void;
}

type PreviewWarning = { code: string; message: string };

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      data: { renderedPrompt: string; warnings: PreviewWarning[] };
    }
  | { status: "error"; error: ApiErrorBody };

export default function PreviewPanel({
  slug,
  draftYaml,
  triggerToken,
  onClose,
}: PreviewPanelProps) {
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  const draftYamlRef = useRef(draftYaml);
  useEffect(() => {
    draftYamlRef.current = draftYaml;
  }, [draftYaml]);

  useEffect(() => {
    if (triggerToken === 0) return;
    const controller = new AbortController();
    (async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(`/api/wiki-types/${slug}/preview`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptYaml: draftYamlRef.current }),
          signal: controller.signal,
        });
        if (!res.ok) {
          let body: ApiErrorBody;
          try {
            body = (await res.json()) as ApiErrorBody;
          } catch {
            body = { error: `Preview failed (${res.status})` };
          }
          setState({ status: "error", error: body });
          return;
        }
        const json = (await res.json()) as {
          renderedPrompt: string;
          warnings: PreviewWarning[];
        };
        setState({ status: "success", data: json });
      } catch (err) {
        if ((err as { name?: string } | null)?.name === "AbortError") return;
        setState({
          status: "error",
          error: { error: NETWORK_ERROR_MESSAGE },
        });
      }
    })();
    return () => controller.abort();
  }, [triggerToken, slug]);

  return (
    <aside
      className="flex flex-col gap-3 rounded border border-input bg-background p-4"
      aria-label="Prompt preview"
    >
      <header className="flex items-center justify-between gap-2">
        <span
          style={{
            ...T.bodySmall,
            fontWeight: 600,
            color: "var(--heading-color)",
          }}
        >
          Preview
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      {state.status === "idle" ? (
        <p className="text-sm text-muted-foreground">
          Click Preview to render.
        </p>
      ) : state.status === "loading" ? (
        <div className="flex h-[300px] items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : state.status === "error" ? (
        <ValidationBanner error={state.error} />
      ) : (
        <>
          {state.data.warnings.length > 0 ? (
            <div
              role="status"
              className="flex flex-col gap-1.5 rounded border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className="size-4 shrink-0 text-amber-600"
                  aria-hidden
                />
                <span className="font-medium text-amber-900 dark:text-amber-200">
                  {state.data.warnings.length === 1 ? "Warning" : "Warnings"}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {state.data.warnings.map((w, i) => (
                  <li
                    key={`${w.code}-${i}`}
                    className="flex items-start gap-2"
                  >
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-mono"
                    >
                      {w.code}
                    </Badge>
                    <span className="flex-1 text-foreground">{w.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(state.data.renderedPrompt);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute right-2 top-2 z-10 rounded border border-input bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
              aria-label="Copy rendered prompt"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <ScrollArea className="h-[600px] rounded border border-input">
              <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs">
                {state.data.renderedPrompt}
              </pre>
            </ScrollArea>
          </div>
        </>
      )}
    </aside>
  );
}
