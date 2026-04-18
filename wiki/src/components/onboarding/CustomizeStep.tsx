"use client";

import { useState } from "react";
import { T } from "@/lib/typography";
import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CustomizeStepProps {
  onNext: () => void;
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="text-[var(--helper-text)]"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" />
      <path d="M8 7V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="text-[var(--input-placeholder)]"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const embeddingModels = [
  "text-embedding-3-small",
  "text-embedding-3-large",
  "text-embedding-ada-002",
];

const fragmentModels = [
  "text-embedding-3-small",
  "text-embedding-3-large",
  "text-embedding-ada-002",
];

const labelClass =
  "uppercase tracking-[0.32px] text-[12px] flex items-center gap-2";

export default function CustomizeStep({ onNext }: CustomizeStepProps) {
  const [apiKey, setApiKey] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState(embeddingModels[0]);
  const [fragmentModel, setFragmentModel] = useState(fragmentModels[0]);

  const canContinue = apiKey.trim().length > 0;

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
        Customize your wiki
      </h1>

      <p
        className="w-full"
        style={{
          marginTop: 8,
          ...T.micro,
          color: "var(--section-label)",
        }}
      >
        Robin uses{" "}
        <a
          href="https://openrouter.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: "var(--section-label)" }}
        >
          OpenRouter
        </a>{" "}
        to access language models.
      </p>

      <div className="mt-10 flex w-full flex-col gap-1.5">
        <Label
          htmlFor="onboarding-api-key"
          className={labelClass}
          style={{ color: "var(--helper-text)" }}
        >
          OpenRouter API Key
          <InfoIcon />
        </Label>
        <Input
          id="onboarding-api-key"
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk or pk"
          autoComplete="off"
        />
        <p
          className="mt-1"
          style={{ ...T.helper, color: "var(--helper-text)" }}
        >
          Your key is stored securely. Robin never sees it.
        </p>
      </div>

      <div
        className="my-7 w-full"
        style={{ height: 1, backgroundColor: "var(--card-border)" }}
      />

      <div className="flex w-full flex-col gap-1.5">
        <Label
          htmlFor="onboarding-embedding-model"
          className={labelClass}
          style={{ color: "var(--helper-text)" }}
        >
          Embedding Model
        </Label>
        <div className="relative w-full">
          <select
            id="onboarding-embedding-model"
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            className="flex h-8 w-full appearance-none items-center rounded-lg border border-input bg-transparent px-2.5 pr-10 text-sm outline-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            style={{ color: "var(--heading-color)" }}
          >
            {embeddingModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            <ChevronDownIcon />
          </div>
        </div>
      </div>

      <div className="mt-6 flex w-full flex-col gap-1.5">
        <Label
          htmlFor="onboarding-fragment-model"
          className={labelClass}
          style={{ color: "var(--helper-text)" }}
        >
          Fragment Processing Model
        </Label>
        <div className="relative w-full">
          <select
            id="onboarding-fragment-model"
            value={fragmentModel}
            onChange={(e) => setFragmentModel(e.target.value)}
            className="flex h-8 w-full appearance-none items-center rounded-lg border border-input bg-transparent px-2.5 pr-10 text-sm outline-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            style={{ color: "var(--heading-color)" }}
          >
            {fragmentModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            <ChevronDownIcon />
          </div>
        </div>
      </div>

      <ActionButton
        type="button"
        onClick={onNext}
        disabled={!canContinue}
        className="mt-10 self-end"
      >
        Continue
      </ActionButton>
    </div>
  );
}
