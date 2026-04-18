export type WikiSettingsPrefill = {
  name?: string;
  wikiType?: string;
  folder?: string;
  description?: string;
  regenAuto?: boolean;
  gatekeep?: boolean;
  /** Modal subtitle under the title */
  subtitle?: string;
};

/** Plain text aligned with WikiIntroLead copy (mock article body). */
export const WIKI_INTRO_LEAD_PLAINTEXT =
  "Audre Lorde (/ˈɔːdri ˈlɔːrd/; born Audrey Geraldine Lorde; February 18, 1934 – November 17, 1992) was an American writer, feminist, womanist, librarian, and civil rights activist. She was a self-described";

/**
 * Maps UI chip labels to <select> option values in AddWikiModal.
 * Must cover every WikiType so that opening settings from any wiki pre-fills
 * the Type field correctly.
 */
const CHIP_LABEL_TO_WIKI_TYPE: Record<string, string> = {
  Log: "log",
  Research: "research",
  Belief: "belief",
  Decision: "decision",
  Project: "project",
  Objective: "objective",
  Principles: "principles",
  Skill: "skill",
  Agent: "agent",
  Voice: "voice",
  People: "people",
  Person: "people",
};

export function wikiTypeSelectValueForChip(chipLabel: string): string {
  return CHIP_LABEL_TO_WIKI_TYPE[chipLabel.trim()] ?? "";
}

export function wikiEntitySettingsPrefill(input: {
  title: string;
  chipLabel: string;
}): WikiSettingsPrefill {
  return {
    name: input.title,
    wikiType: wikiTypeSelectValueForChip(input.chipLabel),
    folder: "default",
    description: WIKI_INTRO_LEAD_PLAINTEXT,
    subtitle: `${input.chipLabel} wiki — update name, type, and visibility`,
  };
}
