"use client";

import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import {
  EditorView,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
  hoverTooltip,
} from "@codemirror/view";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import type { InputVariable } from "@/hooks/useWikiTypesList";

export interface PromptEditorCMProps {
  value: string;
  onChange: (v: string) => void;
  onViewReady?: (view: EditorView) => void;
  compact?: boolean;
  variables: InputVariable[];
}

const HBS_TOKEN_RE = /\{\{\s*([a-zA-Z_][\w.-]*)\s*\}\}/g;

function makeHbsHighlighter(knownVars: Set<string>) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view);
      }
      build(view: EditorView): DecorationSet {
        const b = new RangeSetBuilder<Decoration>();
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          HBS_TOKEN_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = HBS_TOKEN_RE.exec(text)) !== null) {
            const start = from + m.index;
            const end = start + m[0].length;
            const cls = knownVars.has(m[1]) ? "cm-hbs-token" : "cm-hbs-token-unknown";
            b.add(start, end, Decoration.mark({ class: cls }));
          }
        }
        return b.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}

function makeHbsHoverTooltip(variables: InputVariable[]) {
  const metaByName = new Map<string, InputVariable>();
  for (const v of variables) metaByName.set(v.name, v);
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const text = line.text;
    HBS_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = HBS_TOKEN_RE.exec(text)) !== null) {
      const start = line.from + m.index;
      const end = start + m[0].length;
      if (pos >= start && pos <= end) {
        const name = m[1];
        const meta = metaByName.get(name);
        return {
          pos: start,
          end,
          above: true,
          create: () => {
            const dom = document.createElement("div");
            dom.className = "cm-hbs-tooltip";
            dom.textContent = meta
              ? `${name}: ${meta.description}`
              : `Unknown variable: ${name}`;
            return { dom };
          },
        };
      }
    }
    return null;
  });
}

export default function PromptEditorCM({
  value,
  onChange,
  onViewReady,
  compact = false,
  variables,
}: PromptEditorCMProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const html = document.documentElement;
    const read = () =>
      setTheme(html.dataset.theme === "dark" ? "dark" : "light");
    read();
    const obs = new MutationObserver((muts) => {
      for (const m of muts) if (m.attributeName === "data-theme") read();
    });
    obs.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const knownVarsKey = useMemo(
    () => variables.map((v) => v.name).sort().join(","),
    [variables],
  );

  const extensions = useMemo(() => {
    const known = new Set(variables.map((v) => v.name));
    const base = [
      yaml(),
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      makeHbsHighlighter(known),
      makeHbsHoverTooltip(variables),
    ];
    return theme === "dark" ? [...base, oneDark] : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, knownVarsKey]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        searchKeymap: false,
        autocompletion: false,
        dropCursor: true,
        allowMultipleSelections: false,
      }}
      theme={theme === "dark" ? "dark" : "light"}
      height={compact ? "320px" : "100%"}
      minHeight={compact ? "320px" : "400px"}
      maxHeight={compact ? "60vh" : "70vh"}
      onCreateEditor={(view) => onViewReady?.(view)}
    />
  );
}
