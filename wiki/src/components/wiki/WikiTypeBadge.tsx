import { createElement } from "react";
import {
  AudioWaveform,
  Bookmark,
  Bot,
  Circle,
  ClipboardList,
  FileText,
  HelpCircle,
  Hourglass,
  Laptop,
  Lightbulb,
  Link2,
  NotebookText,
  Quote as QuoteIcon,
  UserRound,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const WIKI_TYPES = {
  Log:       { bg: "var(--wiki-type-log-bg)",       text: "var(--wiki-type-log-text)",       border: "var(--wiki-type-log-border)" },
  Research:  { bg: "var(--wiki-type-research-bg)",  text: "var(--wiki-type-research-text)",  border: "var(--wiki-type-research-border)" },
  Belief:    { bg: "var(--wiki-type-belief-bg)",    text: "var(--wiki-type-belief-text)",    border: "var(--wiki-type-belief-border)" },
  Decision:  { bg: "var(--wiki-type-decision-bg)",  text: "var(--wiki-type-decision-text)",  border: "var(--wiki-type-decision-border)" },
  Objective:  { bg: "var(--wiki-type-objective-bg)",  text: "var(--wiki-type-objective-text)",  border: "var(--wiki-type-objective-border)" },
  Project:    { bg: "var(--wiki-type-project-bg)",    text: "var(--wiki-type-project-text)",    border: "var(--wiki-type-project-border)" },
  Principles: { bg: "var(--wiki-type-principles-bg)", text: "var(--wiki-type-principles-text)", border: "var(--wiki-type-principles-border)" },
  Skill:     { bg: "var(--wiki-type-skill-bg)",     text: "var(--wiki-type-skill-text)",     border: "var(--wiki-type-skill-border)" },
  Agent:     { bg: "var(--wiki-type-agent-bg)",     text: "var(--wiki-type-agent-text)",     border: "var(--wiki-type-agent-border)" },
  Voice:     { bg: "var(--wiki-type-voice-bg)",     text: "var(--wiki-type-voice-text)",     border: "var(--wiki-type-voice-border)" },
  People:    { bg: "var(--wiki-type-people-bg)",    text: "var(--wiki-type-people-text)",    border: "var(--wiki-type-people-border)" },
  Person:    { bg: "var(--wiki-type-people-bg)",    text: "var(--wiki-type-people-text)",    border: "var(--wiki-type-people-border)" },
  Entry:     { bg: "var(--wiki-type-entry-bg)",     text: "var(--wiki-type-entry-text)",     border: "var(--wiki-type-entry-border)" },
  Fragment:  { bg: "var(--wiki-type-fragment-bg)",  text: "var(--wiki-type-fragment-text)",  border: "var(--wiki-type-fragment-border)" },
} as const;

/**
 * Types that intentionally render with NO icon. People keeps its UserRound
 * icon; Entry and Fragment are grey, iconless, non-editable meta badges.
 */
const ICONLESS_TYPES = new Set<string>(["Entry", "Fragment"]);

const FRAGMENT_TYPES = {
  Fact:      { bg: "var(--fragment-type-fact-bg)",      text: "var(--fragment-type-fact-text)",      border: "var(--fragment-type-fact-border)" },
  Question:  { bg: "var(--fragment-type-question-bg)",  text: "var(--fragment-type-question-text)",  border: "var(--fragment-type-question-border)" },
  Idea:      { bg: "var(--fragment-type-idea-bg)",      text: "var(--fragment-type-idea-text)",      border: "var(--fragment-type-idea-border)" },
  Action:    { bg: "var(--fragment-type-action-bg)",    text: "var(--fragment-type-action-text)",    border: "var(--fragment-type-action-border)" },
  Quote:     { bg: "var(--fragment-type-quote-bg)",     text: "var(--fragment-type-quote-text)",     border: "var(--fragment-type-quote-border)" },
  Reference: { bg: "var(--fragment-type-reference-bg)", text: "var(--fragment-type-reference-text)", border: "var(--fragment-type-reference-border)" },
} as const;

export type FragmentType = keyof typeof FRAGMENT_TYPES;

const FRAGMENT_TYPE_ICONS: Record<FragmentType, LucideIcon> = {
  Fact: FileText,
  Question: HelpCircle,
  Idea: Lightbulb,
  Action: Zap,
  Quote: QuoteIcon,
  Reference: Link2,
};

export type WikiType = keyof typeof WIKI_TYPES;

export const EDITABLE_WIKI_TYPES: WikiType[] = [
  "Log",
  "Research",
  "Belief",
  "Decision",
  "Objective",
  "Project",
  "Principles",
  "Skill",
  "Agent",
  "Voice",
];

const WIKI_TYPE_ICONS: Record<WikiType, LucideIcon | undefined> = {
  Log: Circle,
  Research: Bookmark,
  Belief: Circle,
  Decision: Circle,
  Objective: Wind,
  Project: ClipboardList,
  Principles: Hourglass,
  Skill: Laptop,
  Agent: Bot,
  Voice: AudioWaveform,
  People: UserRound,
  Person: UserRound,
  Entry: NotebookText,
  Fragment: FileText,
};

export function isPeopleWikiType(type: string) {
  return type === "People" || type === "Person";
}

export function getWikiTypeIcon(type: string): LucideIcon | undefined {
  return (
    WIKI_TYPE_ICONS[type as WikiType] ??
    FRAGMENT_TYPE_ICONS[type as FragmentType] ??
    Circle
  );
}

export function getWikiTypeColors(type: string) {
  return (
    WIKI_TYPES[type as WikiType] ??
    FRAGMENT_TYPES[type as FragmentType] ??
    WIKI_TYPES.Log
  );
}

function isFragmentType(type: string): type is FragmentType {
  return type in FRAGMENT_TYPES;
}

export function WikiTypeBadge({
  type,
  icon: Icon,
  className,
}: {
  type: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const colors = getWikiTypeColors(type);
  // Fragments (the fragment-subtype set) and the iconless wiki-type badges
  // (Entry, Fragment) render without an icon unless one is explicitly provided.
  const badgeIcon =
    Icon ??
    (isFragmentType(type) || ICONLESS_TYPES.has(type)
      ? undefined
      : getWikiTypeIcon(type));

  return (
    <Badge
      variant="outline"
      className={cn("rounded-sm", className)}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border,
        height: 22,
        padding: "0 8px",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.01em",
        lineHeight: 1,
        gap: 4,
      }}
    >
      {badgeIcon ? createElement(badgeIcon, { size: 12, strokeWidth: 1.5 }) : null}
      {type === "People" ? "Person" : type}
    </Badge>
  );
}
