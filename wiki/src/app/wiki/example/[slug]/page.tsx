"use client";

import { useParams, notFound } from "next/navigation";
import { T } from "@/lib/typography";
import {
  WikiEntityArticle,
  WikiLink,
  WikiSectionH2,
} from "@/components/wiki/WikiEntityArticle";

interface ExampleEntry {
  slug: string;
  chipLabel: string;
  title: string;
  lede: string;
  sectionTitle: string;
  sectionBody: string;
}

const EXAMPLES: Record<string, ExampleEntry> = {
  "morning-journal": {
    slug: "morning-journal",
    chipLabel: "Log",
    title: "Morning journal — Apr 16",
    lede:
      "Woke early. Coffee on the fire escape. The city sounded soft for a Tuesday — trash trucks, pigeons, a saxophone two blocks over. I tried to hold the feeling of unhurried attention before my phone pulled me back in.",
    sectionTitle: "What I noticed",
    sectionBody:
      "Mornings are the one window where I can think without negotiation. When I lose the morning to notifications, the whole day runs tactical — answering, not asking. The rule holds: protect the first ninety minutes.",
  },
  "spatial-memory-corvids": {
    slug: "spatial-memory-corvids",
    chipLabel: "Research",
    title: "Spatial memory in corvids",
    lede:
      "Clark's nutcrackers cache tens of thousands of pine seeds across miles of terrain and recover a startling fraction of them months later. The mechanism is partly landmark-based and partly, it seems, something we still do not have a good name for.",
    sectionTitle: "Open questions",
    sectionBody:
      "Do corvids form a genuinely allocentric map, or do they chain together egocentric views? The behavioural evidence pulls one way, the hippocampal anatomy another. Field data from subalpine sites disagrees with lab results in ways that are too consistent to be noise.",
  },
  "craft-compounds": {
    slug: "craft-compounds",
    chipLabel: "Belief",
    title: "Craft compounds over time",
    lede:
      "Skill is not a flat resource. A year of careful work makes the next year's careful work cheaper, because the taste you built last year filters what you even attempt this year. The compounding is hidden because it shows up as speed, not ability.",
    sectionTitle: "Why it is easy to miss",
    sectionBody:
      "Most of the compounding is invisible. It lives in the thousand things you don't try, the wrong turns you don't take, the arguments you don't have because you already had them at 2 a.m. five years ago. The output looks like talent. It is mostly unwasted time.",
  },
  "ship-the-atlas": {
    slug: "ship-the-atlas",
    chipLabel: "Objective",
    title: "Ship the atlas by Q3",
    lede:
      "The atlas has to be in readers' hands before the autumn conference. That means copy frozen by late June, plates to the printer by mid-July, and a two-week buffer I will almost certainly burn through.",
    sectionTitle: "What has to be true",
    sectionBody:
      "Three things: the index has to be redone from scratch (the current one is inherited and wrong in subtle ways), the north-polar maps need a second pass with the new projection, and the licensing conversation with the cartographer has to actually close. The third is the risk.",
  },
  "robin-personal-wiki": {
    slug: "robin-personal-wiki",
    chipLabel: "Project",
    title: "Robin personal wiki",
    lede:
      "A personal wiki built around fragments — small captured thoughts — that get threaded into longer wiki entries over time. The idea is to lower the cost of capture so much that nothing is lost, then do the synthesis work elsewhere.",
    sectionTitle: "Current shape",
    sectionBody:
      "Onboarding, home, search, a people entity view, a knowledge-graph canvas, and a prompt-customization layer for each wiki type. Most of the interesting work ahead is about how fragments promote themselves into structure without the user having to file them.",
  },
  "measure-twice": {
    slug: "measure-twice",
    chipLabel: "Principles",
    title: "Measure twice, cut once",
    lede:
      "The old carpenter's rule — take the extra minute to verify before you make an irreversible cut. It reads as a platitude until you've destroyed a piece of expensive stock because you trusted a number in your head.",
    sectionTitle: "Software version",
    sectionBody:
      "Irreversible operations — production migrations, force-pushes, sending external messages, dropping data — deserve the same pause. The cost of verifying is measured in seconds. The cost of the wrong cut is measured in weeks.",
  },
  "type-design-fundamentals": {
    slug: "type-design-fundamentals",
    chipLabel: "Skill",
    title: "Type design fundamentals",
    lede:
      "The difference between a decent typeface and a working one is usually invisible at the glyph level. It shows up in spacing, in the transitions between weights, in how the italics sit against the roman on a page of mixed running text.",
    sectionTitle: "Where beginners get stuck",
    sectionBody:
      "Almost always at spacing, because spacing is where the craft stops being about drawing and starts being about rhythm. Drawing a clean lowercase 'a' is a weekend. Spacing a text face is a year, and you do not know you are bad at it until you print a paragraph.",
  },
  "research-assistant": {
    slug: "research-assistant",
    chipLabel: "Agent",
    title: "Research assistant",
    lede:
      "An agent tuned for the early-stage literature pass: take a seed question, pull adjacent papers, summarise the dominant framings, and surface the points of real disagreement between authors who seem to agree.",
    sectionTitle: "What it should not do",
    sectionBody:
      "Form opinions. The job is to widen the search, flag what the human should read in full, and point out when a citation chain is circular. The moment it starts confidently telling me which paper is right, it has overstepped.",
  },
  "quiet-morning-tone": {
    slug: "quiet-morning-tone",
    chipLabel: "Voice",
    title: "Quiet morning tone",
    lede:
      "A writing register for the first hour of the day — low-contrast, slightly underwritten, willing to leave sentences short. It trusts the reader to fill the quiet rather than filling it for them.",
    sectionTitle: "How it differs from the evening voice",
    sectionBody:
      "The evening voice argues. It uses semicolons. The morning voice observes. It uses full stops. They are not rankings of quality — they are different tools for different times, and the main mistake is to edit one into the other and lose both.",
  },
};

export default function WikiExamplePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const entry = slug ? EXAMPLES[slug] : undefined;

  if (!entry) {
    notFound();
  }

  const bodyStyle = { ...T.bodySmall, color: "var(--wiki-article-text)" };

  return (
    <WikiEntityArticle
      chipLabel={entry.chipLabel}
      title={entry.title}
      infobox={{ kind: "simple", typeLabel: entry.chipLabel, showSettings: true }}
    >
      <div style={bodyStyle}>
        <p style={{ marginBottom: 0 }}>{entry.lede}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <WikiSectionH2 title={entry.sectionTitle} />
        <p style={{ ...bodyStyle, margin: 0 }}>{entry.sectionBody}</p>
        <p style={{ ...bodyStyle, margin: 0 }}>
          See also <WikiLink>related work</WikiLink> and the{" "}
          <WikiLink>project journal</WikiLink> for context on how this entry fits
          into the broader wiki.
        </p>
      </div>
    </WikiEntityArticle>
  );
}
