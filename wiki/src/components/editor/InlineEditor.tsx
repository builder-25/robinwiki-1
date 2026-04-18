"use client";

import { useEffect } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";

type InlineEditorProps = {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
};

/**
 * Inline, chromeless Tiptap editor.
 *
 * Renders the passed HTML/markdown-as-html with the same typography as the
 * read-mode article, and lets the user click anywhere to edit in place.
 * No toolbar, no border, no background — it looks like editing the page.
 */
export default function InlineEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Write something...",
}: InlineEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === content) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  if (!editor) return null;

  // Reuse `.wiki-richtext-editor` so the ProseMirror surface inherits the
  // exact same prose styles as `.wiki-richtext-rendered`. No wrapper chrome.
  return (
    <EditorContent
      editor={editor}
      className="wiki-richtext-editor wiki-richtext-rendered"
    />
  );
}
