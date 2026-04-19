"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AiModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
}

export interface ModelPreferences {
  extraction: string;
  classification: string;
  wikiGeneration: string;
  embedding: string;
}

type PipelineRole = keyof ModelPreferences;

const SAFE_EMBEDDING_MODELS = [
  "openai/text-embedding-3-small",
  "qwen/qwen3-embedding-8b",
];

const FALLBACK_DEFAULTS: ModelPreferences = {
  extraction: "google/gemini-2.5-pro",
  classification: "anthropic/claude-haiku-4-5",
  wikiGeneration: "anthropic/claude-sonnet-4-6",
  embedding: "openai/text-embedding-3-small",
};

export function isEmbeddingModel(model: AiModel): boolean {
  return SAFE_EMBEDDING_MODELS.includes(model.id);
}

export function useModelPreferences() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [preferences, setPreferences] =
    useState<ModelPreferences>(FALLBACK_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [modelsResult, prefsResult] = await Promise.allSettled([
        fetch("/api/ai/models", { credentials: "include" }).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json() as Promise<{ models: AiModel[] }>;
        }),
        fetch("/api/users/preferences/models", {
          credentials: "include",
        }).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json() as Promise<ModelPreferences>;
        }),
      ]);

      if (cancelled) return;

      if (modelsResult.status === "fulfilled") {
        setModels(modelsResult.value.models);
      }
      // If models fetch fails, models stays empty; dropdowns show current value only

      if (prefsResult.status === "fulfilled") {
        setPreferences(prefsResult.value);
      } else {
        setError("Could not load model preferences");
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePreference = useCallback(
    async (role: PipelineRole, modelId: string) => {
      setPreferences((prev) => ({ ...prev, [role]: modelId }));
      setSaveStatus("saving");
      clearTimeout(fadeTimer.current);

      try {
        const res = await fetch("/api/users/preferences/models", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ [role]: modelId }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error || `Save failed (${res.status})`,
          );
        }

        setSaveStatus("saved");
        fadeTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        setSaveStatus("error");
        fadeTimer.current = setTimeout(() => setSaveStatus("idle"), 3000);
        // Revert optimistic update
        setPreferences((prev) => ({ ...prev }));
        console.error("Failed to save model preference:", err);
      }
    },
    [],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(fadeTimer.current);
  }, []);

  return {
    models,
    preferences,
    loading,
    error,
    saveStatus,
    updatePreference,
    isEmbeddingModel,
  };
}
