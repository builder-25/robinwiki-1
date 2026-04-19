"use client";

import { createElement, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { EditorView } from "@codemirror/view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { T } from "@/lib/typography";
import { getPromptIcon } from "@/lib/promptIcons";
import { cn } from "@/lib/utils";
import { WIKI_TYPES_LIST_KEY } from "@/hooks/useWikiTypesList";
import type { ApiErrorBody, PromptEditorProps } from "./types";
import VariableChipList from "./VariableChipList";
import ValidationBanner from "./ValidationBanner";
import WarningToast from "./WarningToast";
import ConfirmDialog from "./ConfirmDialog";
import UndoToast from "./UndoToast";
import { NETWORK_ERROR_MESSAGE } from "./errorMessages";
import {
  saveSnapshot,
  readSnapshot,
  clearSnapshot,
} from "./resetSnapshot";
import { useUnsavedGuard } from "./useUnsavedGuard";

// Dynamic-import the CodeMirror wrapper so CM6 never ships in the server bundle.
const PromptEditorCM = dynamic(() => import("./PromptEditorCM"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded border border-input bg-muted/30">
      <Spinner className="size-5" />
    </div>
  ),
});

function PromptHeaderIcon({ slug }: { slug: string }) {
  return createElement(getPromptIcon(slug), {
    size: 20,
    strokeWidth: 1.5,
    style: { color: "var(--prompt-wiki-icon-stroke)" },
  });
}

export default function PromptEditor({
  slug,
  displayLabel,
  initialYaml,
  defaultYaml,
  inputVariables,
  basedOnVersion,
  userModified,
  onSaved,
  onClose,
  compact = false,
  footerActions,
  mode: _mode = "full-yaml",
  onDirtyChange,
}: PromptEditorProps) {
  // mode !== "full-yaml" is a Phase 3 extension point — this plan treats it the same as "full-yaml".
  const [yaml, setYaml] = useState(initialYaml);
  const [savedYaml, setSavedYaml] = useState(initialYaml);
  const [saveError, setSaveError] = useState<ApiErrorBody | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const viewRef = useRef<EditorView | null>(null);

  const queryClient = useQueryClient();
  const isDirty = yaml !== savedYaml;
  useUnsavedGuard(isDirty);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleInsertVariable = useCallback((name: string) => {
    const view = viewRef.current;
    if (!view) return;
    const token = `{{${name}}}`;
    const head = view.state.selection.main.head;
    view.dispatch({
      changes: { from: head, insert: token },
      selection: { anchor: head + token.length },
    });
    view.focus();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/wiki-types/${slug}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptYaml: yaml }),
      });
      if (!res.ok) {
        let body: ApiErrorBody;
        try {
          body = (await res.json()) as ApiErrorBody;
        } catch {
          body = { error: `Save failed (${res.status})` };
        }
        setSaveError(body);
        setWarnings([]);
        setIsSaving(false);
        return;
      }
      const json = (await res.json()) as {
        ok: boolean;
        slug: string;
        basedOnVersion: number;
        warnings: string[];
      };
      setSavedYaml(yaml);
      // The user has committed a new version; previous-reset undo is no longer meaningful.
      clearSnapshot(slug);
      setUndoVisible(false);
      onSaved?.({
        basedOnVersion: json.basedOnVersion,
        warnings: json.warnings ?? [],
      });
      setWarnings(json.warnings ?? []);
      await queryClient.invalidateQueries({ queryKey: WIKI_TYPES_LIST_KEY });
    } catch {
      setSaveError({ error: NETWORK_ERROR_MESSAGE });
      setWarnings([]);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmReset = async () => {
    const pre = yaml;
    try {
      const res = await fetch(`/api/wiki-types/${slug}/reset`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        let body: ApiErrorBody;
        try {
          body = (await res.json()) as ApiErrorBody;
        } catch {
          body = { error: `Reset failed (${res.status})` };
        }
        setSaveError(body);
        return;
      }
      saveSnapshot(slug, pre);
      setYaml(defaultYaml);
      setSavedYaml(defaultYaml);
      setSaveError(null);
      setWarnings([]);
      setUndoVisible(true);
      await queryClient.invalidateQueries({ queryKey: WIKI_TYPES_LIST_KEY });
    } catch {
      setSaveError({ error: NETWORK_ERROR_MESSAGE });
    }
  };

  const handleUndo = async () => {
    const snap = readSnapshot(slug);
    if (!snap) {
      setUndoVisible(false);
      return;
    }
    try {
      const res = await fetch(`/api/wiki-types/${slug}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptYaml: snap.yaml }),
      });
      if (!res.ok) {
        let body: ApiErrorBody;
        try {
          body = (await res.json()) as ApiErrorBody;
        } catch {
          body = { error: `Undo failed (${res.status})` };
        }
        setSaveError(body);
        return;
      }
      setYaml(snap.yaml);
      setSavedYaml(snap.yaml);
      clearSnapshot(slug);
      setUndoVisible(false);
      await queryClient.invalidateQueries({ queryKey: WIKI_TYPES_LIST_KEY });
    } catch {
      setSaveError({ error: NETWORK_ERROR_MESSAGE });
    }
  };

  const requestClose = () => {
    if (isDirty) {
      setCloseConfirmOpen(true);
    } else {
      onClose?.();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header (non-compact) */}
      {!compact ? (
        <header className="flex items-center gap-2.5">
          <PromptHeaderIcon slug={slug} />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              style={{
                ...T.bodySmall,
                fontWeight: 600,
                color: "var(--heading-color)",
              }}
            >
              {displayLabel}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              v{basedOnVersion}
            </Badge>
            {userModified ? (
              <Badge variant="secondary" className="text-[10px]">
                Customized
              </Badge>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </header>
      ) : null}

      {/* Editor + right pane */}
      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-[1fr_220px]",
        )}
      >
        <div className="min-h-[400px] overflow-hidden rounded border border-input bg-background">
          <PromptEditorCM
            value={yaml}
            onChange={setYaml}
            compact={compact}
            variables={inputVariables}
            onViewReady={(v) => {
              viewRef.current = v;
            }}
          />
        </div>
        {!compact ? (
          <aside className="min-w-0">
            <VariableChipList
              variables={inputVariables}
              onInsert={handleInsertVariable}
            />
          </aside>
        ) : null}
      </div>

      {compact ? (
        <Collapsible>
          <CollapsibleTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded border border-input px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
              />
            }
          >
            <ChevronDown className="size-3.5" aria-hidden />
            {inputVariables.length} variable
            {inputVariables.length === 1 ? "" : "s"}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <VariableChipList
              variables={inputVariables}
              onInsert={handleInsertVariable}
            />
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <ValidationBanner error={saveError} />
      <WarningToast warnings={warnings} onDismiss={() => setWarnings([])} />
      <UndoToast
        visible={undoVisible}
        onUndo={handleUndo}
        onDismiss={() => setUndoVisible(false)}
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="Reset to default?"
        description="This replaces your current prompt with the canonical default. You can undo for 10 minutes."
        confirmLabel="Reset"
        destructive
        onConfirm={confirmReset}
      />
      <ConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title="Discard unsaved changes?"
        description="Your edits have not been saved. They will be lost if you close now."
        confirmLabel="Discard"
        destructive
        onConfirm={() => onClose?.()}
      />

      {/* Footer */}
      {compact ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setResetConfirmOpen(true)}
            disabled={!userModified}
            title={userModified ? undefined : "Already at default"}
          >
            Reset
          </Button>
          {footerActions}
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setResetConfirmOpen(true)}
            disabled={!userModified}
            title={userModified ? undefined : "Already at default"}
          >
            Reset
          </Button>
          {footerActions}
          {onClose ? (
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
