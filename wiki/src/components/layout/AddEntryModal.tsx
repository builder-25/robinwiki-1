"use client";

import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { T } from "@/lib/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createEntry } from "@/lib/generated";

export interface AddEntryModalProps {
  open: boolean;
  onClose: () => void;
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

export default function AddEntryModal({ open, onClose }: AddEntryModalProps) {
  const wasOpen = useRef(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Entry created");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      if (!wasOpen.current) {
        setTitle("");
        setContent("");
        setSubmitError(null);
        setSubmitting(false);
        setShowToast(false);
      }
      wasOpen.current = true;
    } else {
      wasOpen.current = false;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setSubmitError("Content is required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error } = await createEntry({
        body: {
          content: trimmedContent,
          title: title.trim() || undefined,
          source: "web",
          type: "thought",
        },
        credentials: "include",
      });

      if (error) {
        const message =
          (error as { error?: string })?.error ?? "Failed to create entry.";
        setSubmitError(message);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["entries"] });
      onClose();
      setToastMessage("Entry created");
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setShowToast(false);
        toastTimerRef.current = null;
      }, 2000);
    } catch {
      setSubmitError("Network error. Check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
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
          className="flex flex-col gap-0 rounded-2xl border-black/10 p-0 sm:max-w-[571px]"
          style={{ maxHeight: "min(500px, 90vh)", overflow: "hidden" }}
        >
          <DialogHeader className="shrink-0 px-5 pb-2 pt-5">
            <DialogTitle
              style={{
                ...T.h1,
                color: "#111111",
                fontWeight: 400,
                margin: 0,
              }}
            >
              Add Entry
            </DialogTitle>
            <DialogDescription
              style={{
                ...T.micro,
                lineHeight: "19px",
                color: "#676d76",
                margin: 0,
              }}
            >
              Capture a thought, note, or idea. Robin will process it
              automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="h-px w-full shrink-0 bg-[#e5e5e5]" />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-2 px-5 pt-4">
              <FieldLabel>Title (optional)</FieldLabel>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your thought a title"
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-2 px-5 pt-4">
              <FieldLabel>Content</FieldLabel>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                rows={6}
                className="min-h-[144px] resize-none"
              />
            </div>

            <div className="pb-5" />

            {submitError ? (
              <div
                role="alert"
                className="px-5 pt-3 text-[13px]"
                style={{ color: "#c0392b" }}
              >
                {submitError}
              </div>
            ) : null}
          </div>

          <div className="h-px w-full shrink-0 bg-[#e5e5e5]" />

          <div className="flex shrink-0 items-center justify-end gap-3 px-5 py-4">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-none bg-[var(--wiki-link)] text-white hover:bg-[var(--wiki-link-hover)]"
            >
              {submitting ? "Adding..." : "Add Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toast
        message={toastMessage}
        visible={!open && showToast}
        onDismiss={() => setShowToast(false)}
      />
    </>
  );
}
