"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { T } from "@/lib/typography";
import { ActionButton } from "@/components/ui/action-button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

interface CustomizeStepProps {
  onNext: () => void;
}

interface AiModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
}

interface ModelPreferences {
  extraction: string;
  classification: string;
  wikiGeneration: string;
  embedding: string;
}

const SAFE_EMBEDDING_MODELS = [
  "openai/text-embedding-3-small",
  "qwen/qwen3-embedding-8b",
] as const;

const FALLBACK_DEFAULTS: ModelPreferences = {
  extraction: "google/gemini-2.5-pro",
  classification: "anthropic/claude-haiku-4-5",
  wikiGeneration: "anthropic/claude-sonnet-4-6",
  embedding: "openai/text-embedding-3-small",
};

/** Hardcoded fallback models when the API is unavailable. */
const FALLBACK_MODELS: AiModel[] = [
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4 (6)", context_length: 200000, pricing: { prompt: "0", completion: "0" } },
  { id: "anthropic/claude-haiku-3.5", name: "Claude 3.5 Haiku", context_length: 200000, pricing: { prompt: "0", completion: "0" } },
  { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", context_length: 1048576, pricing: { prompt: "0", completion: "0" } },
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", context_length: 1047576, pricing: { prompt: "0", completion: "0" } },
  { id: "openai/text-embedding-3-small", name: "text-embedding-3-small", context_length: 8191, pricing: { prompt: "0", completion: "0" } },
  { id: "qwen/qwen3-embedding-8b", name: "Qwen3 Embedding 8B", context_length: 32768, pricing: { prompt: "0", completion: "0" } },
];

const TASK_CONFIGS = [
  { key: "extraction" as const, label: "Fragment Extraction", description: "Extracts knowledge fragments from raw input" },
  { key: "classification" as const, label: "Classification", description: "Classifies fragments into wiki topics" },
  { key: "wikiGeneration" as const, label: "Wiki Generation", description: "Generates wiki article content" },
  { key: "embedding" as const, label: "Embeddings", description: "Vector search (1536-dim models only)" },
] as const;

const labelClass =
  "uppercase tracking-[0.32px] text-[12px] flex items-center gap-2";

/** Group models by provider prefix for readability. */
function groupByProvider(models: AiModel[]): Map<string, AiModel[]> {
  const groups = new Map<string, AiModel[]>();
  for (const model of models) {
    const provider = model.id.split("/")[0] ?? "other";
    const list = groups.get(provider) ?? [];
    list.push(model);
    groups.set(provider, list);
  }
  return groups;
}

function ModelSelect({
  id,
  models,
  value,
  onChange,
  disabled,
}: {
  id: string;
  models: AiModel[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const grouped = groupByProvider(models);

  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent pr-8 pl-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
        style={{ ...T.input, fontSize: 13 }}
      >
        {Array.from(grouped.entries()).map(([provider, providerModels]) => (
          <optgroup key={provider} label={provider}>
            {providerModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export default function CustomizeStep({ onNext }: CustomizeStepProps) {
  const [models, setModels] = useState<AiModel[] | null>(null);
  const [prefs, setPrefs] = useState<ModelPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsRes, prefsRes] = await Promise.all([
        fetch("/api/ai/models", { credentials: "include" }).catch(() => null),
        fetch("/api/users/preferences/models", { credentials: "include" }).catch(() => null),
      ]);

      let fetchedModels: AiModel[] = FALLBACK_MODELS;
      if (modelsRes?.ok) {
        const body = await modelsRes.json();
        if (Array.isArray(body.models) && body.models.length > 0) {
          fetchedModels = body.models;
        }
      }

      let fetchedPrefs: ModelPreferences = FALLBACK_DEFAULTS;
      if (prefsRes?.ok) {
        const body = await prefsRes.json();
        fetchedPrefs = {
          extraction: body.extraction || FALLBACK_DEFAULTS.extraction,
          classification: body.classification || FALLBACK_DEFAULTS.classification,
          wikiGeneration: body.wikiGeneration || FALLBACK_DEFAULTS.wikiGeneration,
          embedding: body.embedding || FALLBACK_DEFAULTS.embedding,
        };
      }

      setModels(fetchedModels);
      setPrefs(fetchedPrefs);
    } catch {
      setModels(FALLBACK_MODELS);
      setPrefs(FALLBACK_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updatePref = (key: keyof ModelPreferences, value: string) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleContinue = async () => {
    if (!prefs) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/users/preferences/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to save preferences" }));
        setError(body.detail || body.error || "Failed to save preferences");
        setSaving(false);
        return;
      }
      onNext();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  const chatModels = models ?? FALLBACK_MODELS;
  const embeddingModels = chatModels.filter((m) =>
    (SAFE_EMBEDDING_MODELS as readonly string[]).includes(m.id),
  );

  // If the embedding models list is empty after filtering (API returned models
  // but none matched safe list), add safe models as fallback entries
  const effectiveEmbeddingModels =
    embeddingModels.length > 0
      ? embeddingModels
      : FALLBACK_MODELS.filter((m) =>
          (SAFE_EMBEDDING_MODELS as readonly string[]).includes(m.id),
        );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ width: 320, minHeight: 300 }}>
        <Spinner className="size-6" />
        <p
          className="mt-4"
          style={{ ...T.micro, color: "var(--section-label)" }}
        >
          Loading models...
        </p>
      </div>
    );
  }

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
        Choose your models
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
        to access language models. Pick a model for each stage of the pipeline.
      </p>

      <div className="mt-8 flex w-full flex-col gap-5">
        {TASK_CONFIGS.map((task) => {
          const isEmbedding = task.key === "embedding";
          const selectModels = isEmbedding ? effectiveEmbeddingModels : chatModels;

          return (
            <div key={task.key} className="flex w-full flex-col gap-1.5">
              <Label
                htmlFor={`model-${task.key}`}
                className={labelClass}
                style={{ color: "var(--helper-text)" }}
              >
                {task.label}
              </Label>
              <ModelSelect
                id={`model-${task.key}`}
                models={selectModels}
                value={prefs?.[task.key] ?? ""}
                onChange={(v) => updatePref(task.key, v)}
                disabled={saving}
              />
              <p style={{ ...T.helper, color: "var(--helper-text)" }}>
                {task.description}
              </p>
            </div>
          );
        })}
      </div>

      {error && (
        <p
          className="mt-3 w-full"
          style={{ ...T.helper, color: "var(--destructive, #ef4444)" }}
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
          onClick={onNext}
          disabled={saving}
          className="rounded-none"
          style={{ color: "var(--skip-link)" }}
        >
          Skip
        </Button>
        <ActionButton
          type="button"
          onClick={handleContinue}
          disabled={saving}
        >
          {saving ? "Saving..." : "Continue"}
        </ActionButton>
      </div>
    </div>
  );
}
