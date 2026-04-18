"use client";

import { Bookmark } from "lucide-react";
import { WikiStandardEntityPage } from "@/components/wiki/WikiStandardEntityPage";

export default function WikiResearchPage() {
  return (
    <WikiStandardEntityPage
      chipIcon={Bookmark}
      chipLabel="Research"
      title="Clarity Over Comprehensiveness"
    />
  );
}
