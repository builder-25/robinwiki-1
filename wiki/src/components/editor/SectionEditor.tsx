"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export interface SectionEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The heading text (without `#` markers) — displayed read-only in the dialog header. */
  heading: string;
  /** Prefill for the textarea. The caller strips the heading line so users only see the body. */
  initialBody: string;
  /** Called with the edited body (heading-less). Caller rebuilds heading + body before PUT. */
  onSave: (newBody: string) => Promise<void> | void;
  isSaving?: boolean;
  /** Surface async errors (e.g. stale anchor, network fail) above the Save button. */
  error?: string | null;
}

/**
 * Dialog-wrapped markdown textarea for section-scoped edits.
 *
 * Intentionally uses a plain `<textarea>` instead of the Tiptap
 * `InlineEditor` — Tiptap is HTML-in/HTML-out, and section editing
 * needs lossless markdown round-trip so `replaceSectionInMarkdown` can
 * splice the edited body back into the full document. Re-routing
 * through HTML would mangle raw tokens like `[[person:foo]]`, fenced
 * code blocks, and list markers.
 *
 * The heading is shown as read-only context above the textarea per the
 * Q8 body-only policy: the caller preserves the original heading line
 * so the section anchor stays stable.
 */
export default function SectionEditor({
  open,
  onOpenChange,
  heading,
  initialBody,
  onSave,
  isSaving = false,
  error = null,
}: SectionEditorProps) {
  // Reset the draft whenever the dialog opens or the target section
  // changes. Uses the React docs "storing previous prop in state"
  // pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // so we avoid the cascading-render hit that an effect + setState
  // would cause. `openKey` is null when the dialog is closed and equal
  // to the current `initialBody` when it's open; when the key changes,
  // the draft resets synchronously during render.
  const openKey = open ? initialBody : null;
  const [prevOpenKey, setPrevOpenKey] = useState<string | null>(openKey);
  const [draft, setDraft] = useState(initialBody);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (openKey !== null) {
      setDraft(openKey);
    }
  }

  // Focus the textarea on open so the user can start typing immediately.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  const handleCancel = () => {
    if (isSaving) return;
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (isSaving) return;
    await onSave(draft);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Edit section</DialogTitle>
          <DialogDescription>
            Editing the body of{" "}
            <span style={{ fontFamily: "monospace" }}>{heading}</span>. The
            heading itself stays fixed — use the full Edit tab to rename it.
          </DialogDescription>
        </DialogHeader>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={isSaving}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 280,
            padding: 12,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.5,
            background: "var(--wiki-article-bg, transparent)",
            color: "var(--wiki-article-text)",
            border: "1px solid var(--wiki-card-border)",
            borderRadius: 4,
            resize: "vertical",
            outline: "none",
          }}
        />
        {error ? (
          <p
            role="alert"
            style={{
              color: "red",
              fontSize: 12,
              margin: "4px 0 0",
            }}
          >
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner className="size-4" /> Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
