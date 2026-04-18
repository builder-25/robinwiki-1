// Seed data for the Knowledge Graph page. Mirrors the node/edge shape used in
// robinwiki's GET /graph so we can swap this for a real fetch later without
// touching the renderer.

export type GraphNodeType = "wiki" | "fragment" | "person";

/** Sub-type for wikis (Belief, Objective, etc.) or fragments (Fact, Idea, etc.) */
export type GraphNodeSubtype = string;

export type GraphNode = {
  id: string;
  label: string;
  type: GraphNodeType;
  size: number;
  /** Wiki or fragment sub-type label. Drives node color. */
  subtype?: GraphNodeSubtype;
  /** Optional slug/key for entity page navigation. Falls back to id. */
  lookupKey?: string;
};

export type GraphEdge = {
  source: string;
  target: string;
  edgeType: "filing" | "wikilink" | "mention";
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

// Labels lifted from the Figma frame so the page visually matches the design.
export const sampleGraphData: GraphData = {
  nodes: [
    // Central wiki
    { id: "w-german-history", label: "German History", type: "wiki", size: 22, subtype: "Research" },

    // Other wikis
    { id: "w-berlin-years", label: "The Berlin years", type: "wiki", size: 12, subtype: "Log" },
    { id: "w-streets", label: "The Streets in Germany", type: "wiki", size: 11, subtype: "Research" },
    { id: "w-dhor", label: "dhor", type: "wiki", size: 9, subtype: "Belief" },
    { id: "w-bmo", label: "BMO", type: "wiki", size: 8, subtype: "Project" },
    { id: "w-hugio", label: "HUGIO", type: "wiki", size: 10, subtype: "Agent" },
    { id: "w-germany", label: "Germany", type: "wiki", size: 10, subtype: "Research" },

    // Fragments
    { id: "f-1", label: "1KNPM2F53AHPC4D11SV0VJMV7", type: "fragment", size: 5, subtype: "Fact" },
    { id: "f-2", label: "F53AHPC4D11SV0VJMVB", type: "fragment", size: 5, subtype: "Quote" },
    { id: "f-3", label: "fragment-3", type: "fragment", size: 4, subtype: "Idea" },
    { id: "f-4", label: "fragment-4", type: "fragment", size: 4, subtype: "Reference" },
    { id: "f-5", label: "fragment-5", type: "fragment", size: 4, subtype: "Question" },
    { id: "f-6", label: "fragment-6", type: "fragment", size: 4, subtype: "Action" },
    { id: "f-7", label: "fragment-7", type: "fragment", size: 4, subtype: "Fact" },
    { id: "f-8", label: "fragment-8", type: "fragment", size: 4, subtype: "Idea" },

    // People
    { id: "p-bismarck", label: "Otto von Bismarck", type: "person", size: 7 },
    { id: "p-wilhelm-ii", label: "Wilhelm II", type: "person", size: 7 },
    { id: "p-friedrich-iii", label: "Friedrich III", type: "person", size: 7 },
    { id: "p-wilhelm-iv", label: "Friedrich Wilhelm IV", type: "person", size: 6 },
    { id: "p-hitler", label: "Hitler", type: "person", size: 6 },
    { id: "p-prince-max", label: "Prince Max of Baden", type: "person", size: 6 },
    { id: "p-martin-luther", label: "Martin Luther", type: "person", size: 6 },
    { id: "p-henry-iv", label: "Henry IV", type: "person", size: 6 },
    { id: "p-pope-gregory", label: "Pope Gregory V", type: "person", size: 6 },
    { id: "p-frederick-barbarossa", label: "Frederick Barbarossa", type: "person", size: 6 },
    { id: "p-eric-solsten", label: "Eric Solsten", type: "person", size: 6 },
  ],
  edges: [
    // Central hub
    { source: "w-german-history", target: "w-berlin-years", edgeType: "wikilink" },
    { source: "w-german-history", target: "w-streets", edgeType: "wikilink" },
    { source: "w-german-history", target: "w-germany", edgeType: "wikilink" },
    { source: "w-german-history", target: "w-hugio", edgeType: "wikilink" },
    { source: "w-german-history", target: "w-dhor", edgeType: "wikilink" },
    { source: "w-german-history", target: "w-bmo", edgeType: "wikilink" },

    // Fragments attached to wikis
    { source: "w-german-history", target: "f-1", edgeType: "filing" },
    { source: "w-german-history", target: "f-2", edgeType: "filing" },
    { source: "w-german-history", target: "f-3", edgeType: "filing" },
    { source: "w-berlin-years", target: "f-4", edgeType: "filing" },
    { source: "w-berlin-years", target: "f-5", edgeType: "filing" },
    { source: "w-streets", target: "f-6", edgeType: "filing" },
    { source: "w-germany", target: "f-7", edgeType: "filing" },
    { source: "w-germany", target: "f-8", edgeType: "filing" },

    // People mentions
    { source: "w-german-history", target: "p-bismarck", edgeType: "mention" },
    { source: "w-german-history", target: "p-wilhelm-ii", edgeType: "mention" },
    { source: "w-german-history", target: "p-hitler", edgeType: "mention" },
    { source: "w-german-history", target: "p-prince-max", edgeType: "mention" },
    { source: "w-german-history", target: "p-eric-solsten", edgeType: "mention" },
    { source: "w-berlin-years", target: "p-friedrich-iii", edgeType: "mention" },
    { source: "w-berlin-years", target: "p-wilhelm-iv", edgeType: "mention" },
    { source: "w-germany", target: "p-wilhelm-ii", edgeType: "mention" },
    { source: "w-germany", target: "p-martin-luther", edgeType: "mention" },
    { source: "w-germany", target: "p-henry-iv", edgeType: "mention" },
    { source: "w-germany", target: "p-pope-gregory", edgeType: "mention" },
    { source: "w-germany", target: "p-frederick-barbarossa", edgeType: "mention" },
  ],
};
