import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SectionedMarkdownBody } from "./SectionedMarkdownBody";

afterEach(cleanup);

const noStyle = {};

describe("<SectionedMarkdownBody> — issue #152 regression", () => {
  it("does not duplicate post-H1 content when the markdown starts with an H1", () => {
    const content = [
      "# Transformer Architecture",
      "",
      "## Overview",
      "",
      "Body of overview.",
      "",
      "## Attention",
      "",
      "Body of attention.",
    ].join("\n");

    render(
      <SectionedMarkdownBody
        content={content}
        refs={{}}
        sections={undefined}
        style={noStyle}
      />,
    );

    // Each body must render exactly once — before the fix, the H1 section's
    // span ran to EOF and also rendered every following H2 body.
    expect(screen.getAllByText(/Body of overview\./)).toHaveLength(1);
    expect(screen.getAllByText(/Body of attention\./)).toHaveLength(1);

    // H2 headings are still present.
    expect(screen.getByRole("heading", { level: 2, name: /Overview/ })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: /Attention/ })).toBeDefined();

    // The H1 body itself is not re-rendered — the wiki page chrome owns
    // the document-level heading (see WikiEntityArticle) so the markdown
    // `# Transformer Architecture` line must not produce an <h1> here.
    expect(
      screen.queryByRole("heading", { level: 1, name: /Transformer Architecture/ }),
    ).toBeNull();
  });

  it("renders bodies once when there is no H1 (preamble path)", () => {
    const content = [
      "## Section A",
      "",
      "Body A.",
      "",
      "## Section B",
      "",
      "Body B.",
    ].join("\n");

    render(
      <SectionedMarkdownBody
        content={content}
        refs={{}}
        sections={undefined}
        style={noStyle}
      />,
    );

    expect(screen.getAllByText(/Body A\./)).toHaveLength(1);
    expect(screen.getAllByText(/Body B\./)).toHaveLength(1);
  });

  it("renders the intro paragraph between H1 and the first H2 exactly once", () => {
    // Matches the real Transformer fixture shape — H1, blank, intro prose
    // (with entity tokens), blank, then the first H2. The intro must
    // appear in the rendered output or the wiki loses its lead paragraph.
    const content = [
      "# Transformer Architecture",
      "",
      "The Transformer discards recurrence in favour of attention.",
      "",
      "## Overview",
      "",
      "Body of overview.",
    ].join("\n");

    render(
      <SectionedMarkdownBody
        content={content}
        refs={{}}
        sections={undefined}
        style={noStyle}
      />,
    );

    // Intro appears exactly once.
    expect(
      screen.getAllByText(
        /The Transformer discards recurrence in favour of attention\./,
      ),
    ).toHaveLength(1);
    // Body also appears exactly once (regression guard shared with case 1).
    expect(screen.getAllByText(/Body of overview\./)).toHaveLength(1);
    // H1 heading line is still NOT rendered (page chrome owns it).
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: /Transformer Architecture/,
      }),
    ).toBeNull();
  });
});
