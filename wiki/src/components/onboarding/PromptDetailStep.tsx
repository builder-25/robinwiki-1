"use client";

import { useState } from "react";

import { T } from "@/lib/typography";
import { ActionButton } from "@/components/ui/action-button";
import { Textarea } from "@/components/ui/textarea";

interface PromptDetailStepProps {
  onNext: () => void;
}

function UserIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
        stroke="var(--card-desc)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
        stroke="var(--card-desc)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const defaultPrompt = `You are a people-extraction engine. Given a collection of text fragments, identify every distinct person mentioned.

For each person, extract:
- Full name (and any aliases)
- Relationship to the author
- Key context (role, how they met, shared interests)
- Communication style notes
- Last known interaction date

Output structured JSON. Merge duplicates. Flag uncertain identifications.`;

export default function PromptDetailStep({ onNext }: PromptDetailStepProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);

  return (
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
        People Extraction
      </h1>

      <p
        className="w-full"
        style={{
          marginTop: 8,
          ...T.micro,
          color: "var(--section-label)",
        }}
      >
        Controls how Robin identifies and maps relationships from your
        fragments.
      </p>

      <div
        className="flex w-full flex-col"
        style={{ marginTop: 50, gap: 12 }}
      >
        {/* Prompt card header */}
        <div
          className="flex items-center"
          style={{ gap: 9.736 }}
        >
          <div className="shrink-0" style={{ width: 24, height: 24 }}>
            <UserIcon />
          </div>
          <span
            style={{
              ...T.cardTitle,
              color: "var(--card-title)",
            }}
          >
            People Extraction Prompt
          </span>
        </div>

        {/* Editable prompt textarea */}
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="resize-none min-h-[200px]"
          rows={10}
        />

        <span
          style={{
            ...T.cardDesc,
            color: "#616161",
          }}
        >
          This prompt runs whenever Robin processes new fragments to
          identify people and their relationships.
        </span>
      </div>

      <ActionButton type="button" onClick={onNext} className="mt-12 self-end">
        Continue
      </ActionButton>
    </div>
  );
}
