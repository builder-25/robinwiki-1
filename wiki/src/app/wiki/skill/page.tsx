"use client";

import { Laptop } from "lucide-react";
import { WikiStandardEntityPage } from "@/components/wiki/WikiStandardEntityPage";

export default function WikiSkillPage() {
  return (
    <WikiStandardEntityPage
      chipIcon={Laptop}
      chipLabel="Skill"
      title="Build a $2M ARR business by December 2026 — without raising."
      titleEllipsis
    />
  );
}
