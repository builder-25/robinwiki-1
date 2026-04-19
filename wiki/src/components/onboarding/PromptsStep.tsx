"use client";

import { T } from "@/lib/typography";
import { useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Lightbulb,
  Scale,
  Target,
  FolderKanban,
  ScrollText,
  Laptop,
  Bot,
  AudioWaveform,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  WIKI_TYPE_PROMPTS,
  type WikiTypePromptDef,
} from "@/lib/wikiPrompts";

interface PromptsStepProps {
  onNext: () => void;
  onSkip: () => void;
}

interface WikiTypePrompt extends WikiTypePromptDef {
  icon: LucideIcon;
}

const ICONS_BY_KEY: Record<string, LucideIcon> = {
  log: BookOpen,
  research: Lightbulb,
  belief: Scale,
  decision: Scale,
  objective: Target,
  project: FolderKanban,
  principles: ScrollText,
  skill: Laptop,
  agent: Bot,
  voice: AudioWaveform,
};

const WIKI_TYPES: WikiTypePrompt[] = WIKI_TYPE_PROMPTS.map((def) => ({
  ...def,
  icon: ICONS_BY_KEY[def.key] ?? BookOpen,
}));

export default function PromptsStep({ onNext, onSkip }: PromptsStepProps) {
  const [prompts, setPrompts] = useState<Record<string, string>>(() =>
    Object.fromEntries(WIKI_TYPES.map((t) => [t.key, t.defaultPrompt])),
  );
  const [editedKeys, setEditedKeys] = useState<Set<string>>(new Set());
  const [modalType, setModalType] = useState<WikiTypePrompt | null>(null);
  const [modalDraft, setModalDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasEdited = editedKeys.size > 0;

  const handleContinue = async () => {
    if (editedKeys.size === 0) {
      onNext();
      return;
    }
    setSaving(true);
    setError("");
    try {
      await Promise.all(
        Array.from(editedKeys).map((key) =>
          fetch(`/api/wiki-types/${key}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ prompt: prompts[key] }),
          }),
        ),
      );
      onNext();
    } catch {
      setError("Some prompts failed to save, but you can continue.");
      onNext();
    } finally {
      setSaving(false);
    }
  };

  const openModal = (type: WikiTypePrompt) => {
    setModalType(type);
    setModalDraft(prompts[type.key]);
  };

  const handleSave = () => {
    if (!modalType) return;
    setPrompts((prev) => ({ ...prev, [modalType.key]: modalDraft }));
    setEditedKeys((prev) => new Set(prev).add(modalType.key));
    setModalType(null);
  };

  return (
    <>
      <div className="flex flex-col items-start" style={{ width: 320 }}>
        <p
          className="whitespace-nowrap"
          style={{
            ...T.overline,
            color: "var(--section-label)",
          }}
        >
          AI
        </p>

        <h1
          className="whitespace-nowrap"
          style={{
            ...T.h1,
            color: "var(--heading-color)",
          }}
        >
          Customize your prompts
        </h1>

        <p
          className="w-full"
          style={{
            marginTop: 8,
            ...T.micro,
            color: "var(--section-label)",
          }}
        >
          Each wiki type uses its own prompt to process your knowledge.
          Customize any of them.
        </p>

        <div
          className="flex w-full flex-col"
          style={{ marginTop: 32, gap: 10 }}
        >
          {WIKI_TYPES.map((type) => {
              const Icon = type.icon;
              const isEdited = editedKeys.has(type.key);

              return (
                <Button
                  key={type.key}
                  type="button"
                  variant="outline"
                  onClick={() => openModal(type)}
                  className="h-auto w-full justify-start gap-2.5 rounded p-3.5 text-left"
                >
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    className="shrink-0"
                    style={{ color: "var(--prompt-wiki-icon-stroke)" }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span
                      className="w-full"
                      style={{
                        ...T.cardTitle,
                        color: "var(--card-title)",
                      }}
                    >
                      {type.label}
                      {isEdited && (
                        <span
                          style={{
                            marginLeft: 6,
                            ...T.tiny,
                            fontSize: 9,
                            color: "var(--radio-border)",
                          }}
                        >
                          edited
                        </span>
                      )}
                    </span>
                    <span
                      className="w-full whitespace-normal"
                      style={{
                        ...T.cardDesc,
                        color: "#616161",
                      }}
                    >
                      {type.description}
                    </span>
                  </div>
                  <ChevronRight
                    size={16}
                    className="shrink-0"
                    style={{ color: "var(--card-desc)" }}
                  />
                </Button>
              );
          })}
        </div>

        {error && (
          <p
            className="w-full"
            style={{ marginTop: 8, ...T.helper, color: "var(--destructive, #ef4444)" }}
          >
            {error}
          </p>
        )}

        <div
          className="flex w-full items-center justify-between"
          style={{ marginTop: 32 }}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={saving}
            className="rounded-none"
            style={{ color: "var(--skip-link)" }}
          >
            Skip
          </Button>
          <ActionButton
            type="button"
            onClick={handleContinue}
            disabled={!hasEdited || saving}
          >
            {saving ? "Saving..." : "Continue"}
          </ActionButton>
        </div>
      </div>

      <Dialog
        open={Boolean(modalType)}
        onOpenChange={(next) => {
          if (!next) setModalType(null);
        }}
      >
        {modalType ? (
          <DialogContent className="sm:max-w-[480px] gap-4 rounded-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <modalType.icon
                  size={20}
                  strokeWidth={1.5}
                  style={{ color: "var(--prompt-wiki-icon-stroke)" }}
                />
                <span
                  style={{
                    ...T.bodySmall,
                    fontWeight: 600,
                    color: "var(--heading-color)",
                  }}
                >
                  {modalType.label} Prompt
                </span>
              </DialogTitle>
              <DialogDescription>
                {modalType.description}.
              </DialogDescription>
            </DialogHeader>

            <Textarea
              value={modalDraft}
              onChange={(e) => setModalDraft(e.target.value)}
              className="min-h-[240px] resize-none"
              rows={12}
            />

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModalDraft(modalType.defaultPrompt);
                }}
                className="rounded-none"
              >
                Reset
              </Button>
              <ActionButton type="button" onClick={handleSave}>
                Save
              </ActionButton>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
