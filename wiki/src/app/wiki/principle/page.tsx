"use client";

import { Hourglass } from "lucide-react";
import { WikiStandardEntityPage } from "@/components/wiki/WikiStandardEntityPage";

export default function WikiPrinciplePage() {
  return (
    <WikiStandardEntityPage
      chipIcon={Hourglass}
      chipLabel="Principle"
      title="Build a $2M ARR business by December 2026 without raising."
      titleEllipsis
    />
  );
}
