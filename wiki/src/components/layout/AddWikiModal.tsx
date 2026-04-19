"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { WikiSettingsPrefill } from "@/lib/wikiSettingsPrefill";
import {
  getDefaultPrompt,
  getWikiTypeLabel,
} from "@/lib/wikiPrompts";

export type { WikiSettingsPrefill } from "@/lib/wikiSettingsPrefill";

export interface AddWikiModalProps {
  open: boolean;
  onClose: () => void;
  /** Figma 311:5034 — defaults to Create New Wiki */
  title?: string;
  confirmLabel?: string;
  /** When opening from an existing wiki (gear), seed form fields */
  prefill?: WikiSettingsPrefill | null;
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={className}
    >
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1" />
      <path
        d="M7 5.5v3.5M7 4v.25"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label
      className="text-[12px] font-normal leading-4 tracking-[0.32px]"
      style={{ color: "#545353" }}
    >
      {children}
    </Label>
  );
}

const WIKI_TYPES = [
  { value: "log", label: "Log" },
  { value: "research", label: "Research" },
  { value: "belief", label: "Belief" },
  { value: "decision", label: "Decision" },
  { value: "project", label: "Project" },
  { value: "objective", label: "Objective" },
  { value: "principles", label: "Principles" },
  { value: "skill", label: "Skill" },
  { value: "agent", label: "Agent" },
  { value: "voice", label: "Voice" },
  { value: "people", label: "People" },
];

const FOLDERS = [
  { value: "default", label: "Default" },
  { value: "archive", label: "Archive" },
];

export default function AddWikiModal({
  open,
  onClose,
  title = "Create New Wiki",
  confirmLabel = "Create Wiki",
  prefill = null,
}: AddWikiModalProps) {
  const wasOpen = useRef(false);
  const [name, setName] = useState("");
  const [wikiType, setWikiType] = useState("");
  const [folder, setFolder] = useState("");
  const [description, setDescription] = useState("");
  const [regenAuto, setRegenAuto] = useState(false);
  const [gatekeep, setGatekeep] = useState(false);
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  /** Wiki prompt state (emulated local state; will move to OS.robin store later) */
  const [wikiPrompt, setWikiPrompt] = useState<string>("");
  const [wikiPromptEdited, setWikiPromptEdited] = useState<boolean>(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState<string>("");
  /** Existing-wiki settings: form read-only until user clicks Edit Wiki */
  const [fieldsEditable, setFieldsEditable] = useState(true);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const saveCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWikiTypeRef = useRef<string>("");

  const isSettingsView = Boolean(prefill);

  useEffect(() => {
    if (open) {
      if (!wasOpen.current) {
        setShowSavedToast(false);
        if (saveCloseTimerRef.current) {
          clearTimeout(saveCloseTimerRef.current);
          saveCloseTimerRef.current = null;
        }
        if (prefill) {
          const nextType = prefill.wikiType ?? "";
          setName(prefill.name ?? "");
          setWikiType(nextType);
          setFolder(prefill.folder ?? "");
          setDescription(prefill.description ?? "");
          setRegenAuto(prefill.regenAuto ?? false);
          setGatekeep(prefill.gatekeep ?? false);
          setSubtitle(prefill.subtitle);
          setWikiPrompt(getDefaultPrompt(nextType) ?? "");
          setWikiPromptEdited(false);
          prevWikiTypeRef.current = nextType;
          setFieldsEditable(false);
        } else {
          setName("");
          setWikiType("");
          setFolder("");
          setDescription("");
          setRegenAuto(false);
          setGatekeep(false);
          setSubtitle(undefined);
          setWikiPrompt("");
          setWikiPromptEdited(false);
          prevWikiTypeRef.current = "";
          setFieldsEditable(true);
        }
        setPromptDialogOpen(false);
      }
      wasOpen.current = true;
    } else {
      wasOpen.current = false;
    }
  }, [open, prefill]);

  useEffect(() => {
    return () => {
      if (saveCloseTimerRef.current) {
        clearTimeout(saveCloseTimerRef.current);
        saveCloseTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Prompt customization is tied to a specific wiki type. When the type
   * changes, discard any override and reload the new type's default — a
   * "Customized Voice Prompt" wouldn't make sense if the user originally
   * customized the Agent prompt.
   */
  useEffect(() => {
    if (prevWikiTypeRef.current === wikiType) return;
    prevWikiTypeRef.current = wikiType;
    setWikiPromptEdited(false);
    setWikiPrompt(getDefaultPrompt(wikiType) ?? "");
  }, [wikiType]);

  const locked = isSettingsView && !fieldsEditable;

  const handleConfirm = () => {
    if (locked) {
      setFieldsEditable(true);
      return;
    }
    if (isSettingsView) {
      if (saveCloseTimerRef.current) {
        clearTimeout(saveCloseTimerRef.current);
        saveCloseTimerRef.current = null;
      }
      onClose();
      setShowSavedToast(true);
      saveCloseTimerRef.current = setTimeout(() => {
        setShowSavedToast(false);
        saveCloseTimerRef.current = null;
      }, 2000);
      return;
    }
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent
          className="p-0 sm:max-w-[571px] gap-0 rounded-2xl border-black/10 flex flex-col"
          style={{ maxHeight: "min(631px, 90vh)", overflow: "hidden" }}
        >
          <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
            <DialogTitle
              style={{
                ...T.h1,
                color: "#111111",
                fontWeight: 400,
                margin: 0,
              }}
            >
              {title}
            </DialogTitle>
            <DialogDescription
              style={{
                ...T.micro,
                lineHeight: "19px",
                color: "#676d76",
                margin: 0,
              }}
            >
              {subtitle ?? "Create a new wiki to organize your knowledge."}
            </DialogDescription>
          </DialogHeader>

          <div className="h-px w-full bg-[#e5e5e5] shrink-0" />

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto">

          {/* Name */}
          <div className="px-5 pt-4 flex flex-col gap-2">
            <FieldLabel>Name</FieldLabel>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E.g The City of Trust"
              disabled={locked}
              className="h-10"
            />
          </div>

          {/* Type */}
          <div className="px-5 pt-4 flex flex-col gap-2">
            <FieldLabel>
              Type <InfoIcon className="text-[#545353]" />
            </FieldLabel>
            <div className="relative">
              <select
                value={wikiType}
                onChange={(e) => setWikiType(e.target.value)}
                disabled={locked}
                aria-label="Wiki type"
                className="flex h-10 w-full items-center rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none appearance-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{ color: wikiType ? "#111111" : "#a8a8a8" }}
              >
                <option value="">Choose a type</option>
                {WIKI_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#a8a8a8]"
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Description */}
          <div className="px-5 pt-4 flex flex-col gap-2">
            <FieldLabel>
              Description <InfoIcon className="text-[#545353]" />
            </FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Countries I have visited. Whether a specific county meets the threshold."
              rows={3}
              disabled={locked}
              className="min-h-[96px] resize-none"
            />
          </div>

          {/* Wiki Prompt */}
          <div className="px-5 pt-4 flex flex-col gap-2">
            <FieldLabel>
              Wiki Prompt <InfoIcon className="text-[#545353]" />
            </FieldLabel>
            {(() => {
              const hasType = Boolean(wikiType);
              const typeLabel = getWikiTypeLabel(wikiType);
              const promptAvailable = hasType && getDefaultPrompt(wikiType) !== null;
              const disabled = locked || !promptAvailable;
              const badgeText = !hasType
                ? "Pick a type to customize"
                : !promptAvailable
                  ? `No default prompt for ${typeLabel}`
                  : wikiPromptEdited
                    ? `Customized ${typeLabel} Prompt`
                    : `Default ${typeLabel} Prompt`;
              const badgeColors = wikiPromptEdited
                ? { fg: "#3366cc", bg: "rgba(51, 102, 204, 0.10)", bd: "#3366cc" }
                : { fg: "#545353", bg: "#f5f5f5", bd: "#e5e5e5" };
              return (
                <div
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5"
                  style={{ opacity: disabled ? 0.6 : 1 }}
                >
                  <span
                    className="inline-flex items-center"
                    style={{
                      ...T.micro,
                      padding: "2px 8px",
                      color: badgeColors.fg,
                      background: badgeColors.bg,
                      border: `1px solid ${badgeColors.bd}`,
                    }}
                  >
                    {badgeText}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (disabled) return;
                      setPromptDraft(wikiPrompt);
                      setPromptDialogOpen(true);
                    }}
                    disabled={disabled}
                    aria-label="Edit wiki prompt"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#545353] transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Pencil size={14} strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Folder */}
          <div className="px-5 pt-4 flex flex-col gap-2">
            <FieldLabel>
              Folder <InfoIcon className="text-[#545353]" />
            </FieldLabel>
            <div className="relative">
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                disabled
                aria-label="Folder"
                className="flex h-10 w-full items-center rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none appearance-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{ color: folder ? "#111111" : "#a8a8a8" }}
              >
                <option value="">Choose a folder</option>
                {FOLDERS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#a8a8a8]"
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3 px-5 pt-8 pb-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  style={{
                    ...T.body,
                    color: "#6f6f6f",
                    whiteSpace: "nowrap",
                  }}
                >
                  Regenerate Wiki Automatically?
                </span>
                <InfoIcon className="text-[#6f6f6f]" />
              </div>
              <Switch
                checked={regenAuto}
                onCheckedChange={setRegenAuto}
                disabled
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  style={{
                    ...T.body,
                    color: "#6f6f6f",
                    whiteSpace: "nowrap",
                  }}
                >
                  Gatekeep this Wiki?
                </span>
                <InfoIcon className="text-[#6f6f6f]" />
              </div>
              <Switch
                checked={gatekeep}
                onCheckedChange={setGatekeep}
                disabled
              />
            </div>
          </div>

          </div>
          {/* /Scrollable body */}

          <div className="h-px w-full bg-[#e5e5e5] shrink-0" />

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 shrink-0">
            <Button
              type="button"
              onClick={handleConfirm}
              className="rounded-none bg-[#3366cc] text-white hover:bg-[#2a56b0]"
            >
              {locked ? confirmLabel : isSettingsView ? "Save" : confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wiki prompt edit dialog */}
      <Dialog
        open={promptDialogOpen}
        onOpenChange={(next) => {
          if (!next) setPromptDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[480px] gap-4 rounded-xl">
          <DialogHeader>
            <DialogTitle
              style={{
                ...T.bodySmall,
                fontWeight: 600,
                color: "var(--heading-color)",
              }}
            >
              {getWikiTypeLabel(wikiType)} Prompt
            </DialogTitle>
            <DialogDescription>
              Customize how fragments are synthesized into this wiki. Reset to
              use the default {getWikiTypeLabel(wikiType).toLowerCase()} prompt.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value)}
            className="min-h-[240px] resize-none"
            rows={12}
          />

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const def = getDefaultPrompt(wikiType) ?? "";
                setPromptDraft(def);
              }}
              className="rounded-none"
            >
              Reset
            </Button>
            <ActionButton
              type="button"
              onClick={() => {
                const def = getDefaultPrompt(wikiType) ?? "";
                setWikiPrompt(promptDraft);
                setWikiPromptEdited(promptDraft !== def);
                setPromptDialogOpen(false);
              }}
            >
              Save
            </ActionButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Saved toast (kept as a simple fixed banner) */}
      {!open && showSavedToast ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed left-1/2 bottom-10 z-[300] -translate-x-1/2 rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-[#fafafa]"
          style={{
            ...T.button,
            fontWeight: 500,
            letterSpacing: "-0.02px",
            boxShadow:
              "0 10px 28px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
            pointerEvents: "none",
          }}
        >
          Saved
        </div>
      ) : null}
    </>
  );
}
