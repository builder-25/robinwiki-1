"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { T } from "@/lib/typography";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  useWikiTypesList,
  type WikiTypeListItem,
} from "@/hooks/useWikiTypesList";
import { getPromptIcon } from "@/lib/promptIcons";
import { hydrateFromWikiTypes } from "@/lib/wikiPrompts";
import PromptEditor from "@/components/prompts/PromptEditor";

interface PromptsStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function PromptsStep({ onNext, onSkip }: PromptsStepProps) {
  const { data, isLoading, isError } = useWikiTypesList();
  const wikiTypes: WikiTypeListItem[] = data?.wikiTypes ?? [];

  const [modalType, setModalType] = useState<WikiTypeListItem | null>(null);
  const [editedSlugs, setEditedSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data?.wikiTypes) hydrateFromWikiTypes(data.wikiTypes);
  }, [data?.wikiTypes]);

  const hasEdited = editedSlugs.size > 0;

  const handleContinue = () => onNext();

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
          {isLoading ? (
            <div className="flex w-full justify-center py-6">
              <Spinner className="size-5" />
            </div>
          ) : isError ? (
            <p
              className="w-full"
              style={{ ...T.helper, color: "var(--destructive, #ef4444)" }}
            >
              Failed to load wiki types.
            </p>
          ) : (
            wikiTypes.map((type) => {
              const Icon = getPromptIcon(type.slug);
              const isEdited = editedSlugs.has(type.slug);

              return (
                <Button
                  key={type.slug}
                  type="button"
                  variant="outline"
                  onClick={() => setModalType(type)}
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
                      {type.displayLabel}
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
                      {type.displayDescription || type.displayShortDescriptor}
                    </span>
                  </div>
                  <ChevronRight
                    size={16}
                    className="shrink-0"
                    style={{ color: "var(--card-desc)" }}
                  />
                </Button>
              );
            })
          )}
        </div>

        <div
          className="flex w-full items-center justify-between"
          style={{ marginTop: 32 }}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            className="rounded-none"
            style={{ color: "var(--skip-link)" }}
          >
            Skip
          </Button>
          <ActionButton
            type="button"
            onClick={handleContinue}
            disabled={!hasEdited}
          >
            Continue
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
          <DialogContent className="sm:max-w-[720px] gap-4 rounded-xl p-0">
            <DialogHeader className="px-5 pt-5">
              <DialogTitle className="flex items-center gap-2.5">
                {(() => {
                  const Icon = getPromptIcon(modalType.slug);
                  return (
                    <Icon
                      size={20}
                      strokeWidth={1.5}
                      style={{ color: "var(--prompt-wiki-icon-stroke)" }}
                    />
                  );
                })()}
                <span
                  style={{
                    ...T.bodySmall,
                    fontWeight: 600,
                    color: "var(--heading-color)",
                  }}
                >
                  {modalType.displayLabel} Prompt
                </span>
              </DialogTitle>
              <DialogDescription>
                {modalType.displayDescription}
              </DialogDescription>
            </DialogHeader>
            <div className="px-5 pb-5">
              <PromptEditor
                slug={modalType.slug}
                displayLabel={modalType.displayLabel}
                initialYaml={modalType.promptYaml}
                defaultYaml={modalType.defaultYaml}
                inputVariables={modalType.inputVariables}
                basedOnVersion={modalType.basedOnVersion}
                userModified={modalType.userModified}
                compact
                onSaved={() => {
                  setEditedSlugs((prev) => {
                    const next = new Set(prev);
                    next.add(modalType.slug);
                    return next;
                  });
                  setModalType(null);
                }}
                onClose={() => setModalType(null)}
              />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
