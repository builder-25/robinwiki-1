/**
 * Shared default wiki-type prompts.
 *
 * Each wiki type has a default prompt that controls how fragments are
 * synthesized into an article for that type. Used by onboarding
 * (customize-all defaults) and per-wiki settings (override per wiki).
 */

export interface WikiTypePromptDef {
  key: string;
  label: string;
  description: string;
  defaultPrompt: string;
}

export const WIKI_TYPE_PROMPTS: WikiTypePromptDef[] = [
  {
    key: "log",
    label: "Log",
    description: "Controls how daily logs and journal entries are structured",
    defaultPrompt: `You are a log-structuring engine. Given raw text fragments from daily entries, organize them into a structured log article.

Guidelines:
- Preserve chronological order
- Group related entries by theme or project
- Extract key decisions, observations, and action items
- Maintain the author's voice and tone
- Flag recurring patterns or themes

Output well-structured markdown with date headers.`,
  },
  {
    key: "research",
    label: "Research",
    description: "Controls how research notes are compiled and cross-referenced",
    defaultPrompt: `You are a research-synthesis engine. Given fragments from research notes, papers, and observations, compile them into a structured research article.

Guidelines:
- Organize by thesis, evidence, and conclusions
- Cross-reference related findings
- Highlight contradictions or gaps in knowledge
- Include methodology notes where available
- Generate citation links to source fragments

Output well-structured markdown with academic formatting.`,
  },
  {
    key: "belief",
    label: "Belief",
    description: "Controls how beliefs and convictions are articulated",
    defaultPrompt: `You are a belief-articulation engine. Given fragments expressing opinions, convictions, and worldview elements, synthesize them into a clear belief article.

Guidelines:
- State the core belief clearly upfront
- Provide supporting reasoning and evidence
- Acknowledge counterarguments fairly
- Track how the belief has evolved over time
- Link to decisions or actions influenced by this belief

Output well-structured markdown.`,
  },
  {
    key: "decision",
    label: "Decision",
    description: "Controls how decisions are documented with context and rationale",
    defaultPrompt: `You are a decision-documentation engine. Given fragments about a decision, structure them into a clear decision record.

Guidelines:
- State the decision clearly
- Document the context and constraints at the time
- List alternatives considered and why they were rejected
- Capture the expected outcomes and success criteria
- Note who was involved and their perspectives

Output well-structured markdown in ADR format.`,
  },
  {
    key: "objective",
    label: "Objective",
    description: "Controls how objectives are defined with milestones and progress",
    defaultPrompt: `You are an objective-structuring engine. Given fragments about objectives and aspirations, structure them into a clear objective article.

Guidelines:
- State the objective with measurable success criteria
- Break down into milestones and key results
- Document current progress and blockers
- Link to related projects and decisions
- Include timeline and deadline information

Output well-structured markdown.`,
  },
  {
    key: "project",
    label: "Project",
    description: "Controls how project knowledge is organized and tracked",
    defaultPrompt: `You are a project-documentation engine. Given fragments about a project, organize them into a comprehensive project article.

Guidelines:
- Include project overview, goals, and current status
- Document architecture decisions and trade-offs
- Track milestones, deliverables, and timelines
- List team members and their roles
- Capture lessons learned and retrospective notes

Output well-structured markdown.`,
  },
  {
    key: "principles",
    label: "Principles",
    description: "Controls how principles and guidelines are formulated",
    defaultPrompt: `You are a principles-formulation engine. Given fragments expressing rules, guidelines, and operating principles, synthesize them into a clear principles article.

Guidelines:
- State the principle concisely
- Explain the reasoning behind it
- Provide concrete examples of application
- Note exceptions and edge cases
- Link to decisions where the principle was applied

Output well-structured markdown.`,
  },
  {
    key: "skill",
    label: "Skill",
    description: "Controls how skills and competencies are documented",
    defaultPrompt: `You are a skill-documentation engine. Given fragments about abilities, techniques, and competencies, structure them into a skill article.

Guidelines:
- Describe the skill and its current proficiency level
- Document learning resources and methods used
- Track progress milestones and breakthroughs
- Include practical examples and applications
- Link to projects where this skill was applied

Output well-structured markdown.`,
  },
  {
    key: "agent",
    label: "Agent",
    description: "Controls how AI agent configurations are documented",
    defaultPrompt: `You are an agent-documentation engine. Given fragments about an AI agent's purpose, configuration, and behavior, structure them into an agent article.

Guidelines:
- Describe the agent's purpose and capabilities
- Document its system prompt and configuration
- Track performance observations and iterations
- Include usage examples and best practices
- Note limitations and failure modes

Output well-structured markdown.`,
  },
  {
    key: "voice",
    label: "Voice",
    description: "Controls how writing voice profiles are captured",
    defaultPrompt: `You are a voice-profiling engine. Given fragments that demonstrate a particular writing or communication style, synthesize them into a voice profile article.

Guidelines:
- Characterize the tone, register, and personality
- Document vocabulary preferences and patterns
- Note sentence structure and rhythm tendencies
- Include representative examples
- Describe appropriate contexts for this voice

Output well-structured markdown.`,
  },
];

const PROMPT_MAP: Record<string, WikiTypePromptDef> = Object.fromEntries(
  WIKI_TYPE_PROMPTS.map((t) => [t.key, t]),
);

/** Lookup a wiki type's definition by its key. Returns undefined for unknown types. */
export function getWikiTypePrompt(typeKey: string): WikiTypePromptDef | undefined {
  return PROMPT_MAP[typeKey];
}

/** Returns the default prompt for a type, or null if the type has no default. */
export function getDefaultPrompt(typeKey: string): string | null {
  return PROMPT_MAP[typeKey]?.defaultPrompt ?? null;
}

/** Returns the type's display label (e.g. "Agent"), or a titlecased fallback. */
export function getWikiTypeLabel(typeKey: string): string {
  if (PROMPT_MAP[typeKey]) return PROMPT_MAP[typeKey].label;
  if (!typeKey) return "";
  return typeKey.charAt(0).toUpperCase() + typeKey.slice(1);
}
