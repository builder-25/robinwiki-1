import {
  BookOpen,
  Lightbulb,
  Scale,
  Target,
  FolderKanban,
  ScrollText,
  Laptop,
  Bot,
  AudioWaveform,
  type LucideIcon,
} from "lucide-react";

export const PROMPT_ICONS_BY_SLUG: Record<string, LucideIcon> = {
  log: BookOpen,
  research: Lightbulb,
  belief: Scale,
  decision: Scale,
  objective: Target,
  project: FolderKanban,
  principles: ScrollText,
  skill: Laptop,
  agent: Bot,
  voice: AudioWaveform,
};

/** Lookup an icon by slug. Unknown slugs fall back to BookOpen. */
export function getPromptIcon(slug: string): LucideIcon {
  return PROMPT_ICONS_BY_SLUG[slug] ?? BookOpen;
}
