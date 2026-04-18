"use client";

import { Wind } from "lucide-react";
import { WikiStandardEntityPage } from "@/components/wiki/WikiStandardEntityPage";

export default function WikiObjectivePage() {
  return (
    <WikiStandardEntityPage
      chipIcon={Wind}
      chipLabel="Objective"
      title="Build a $2M ARR business by December 2026 — without raising."
      titleEllipsis
    />
  );
}
