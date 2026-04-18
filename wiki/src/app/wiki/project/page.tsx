"use client";

import { ClipboardList } from "lucide-react";
import { WikiStandardEntityPage } from "@/components/wiki/WikiStandardEntityPage";

export default function WikiProjectPage() {
  return (
    <WikiStandardEntityPage
      chipIcon={ClipboardList}
      chipLabel="Project"
      title="Build a $2M ARR business by December 2026 — without raising."
      titleEllipsis
    />
  );
}
