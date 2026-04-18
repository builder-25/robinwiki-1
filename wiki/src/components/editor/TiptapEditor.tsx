"use client";

import { useEffect } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  SquareCode,
  Undo2,
} from "lucide-react";

type TiptapEditorProps = {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  minHeight?: string;
};

export default function TiptapEditor({
  content,
  onChange,
  editable = true,
  minHeight = "320px",
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write something...",
      }),
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

  const toolbarButtonStyle = (active = false) =>
    ({
      width: 30,
      height: 30,
      borderRadius: 4,
      border: "1px solid var(--wiki-card-border)",
      backgroundColor: active ? "#e7e7e7" : "#fff",
      color: "#000",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      padding: 0,
    }) as const;

  return (
    <div
      className="wiki-richtext-shell"
      style={{
        border: "1px solid var(--wiki-card-border)",
        backgroundColor: "#fff",
        minHeight,
      }}
    >
      {editable ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
            padding: "8px 10px",
            borderBottom: "1px solid var(--wiki-card-border)",
            backgroundColor: "#f8f8f8",
          }}
        >
          <button
            type="button"
            title="Paragraph"
            onClick={() => editor.chain().focus().setParagraph().run()}
            style={toolbarButtonStyle(editor.isActive("paragraph"))}
          >
            <Pilcrow size={14} />
          </button>
          <button
            type="button"
            title="Heading 2"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            style={toolbarButtonStyle(editor.isActive("heading", { level: 2 }))}
          >
            <Heading2 size={14} />
          </button>
          <button
            type="button"
            title="Heading 3"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            style={toolbarButtonStyle(editor.isActive("heading", { level: 3 }))}
          >
            <Heading3 size={14} />
          </button>
          <button
            type="button"
            title="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            style={toolbarButtonStyle(editor.isActive("bold"))}
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            style={toolbarButtonStyle(editor.isActive("italic"))}
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            title="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            style={toolbarButtonStyle(editor.isActive("bulletList"))}
          >
            <List size={14} />
          </button>
          <button
            type="button"
            title="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            style={toolbarButtonStyle(editor.isActive("orderedList"))}
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            title="Blockquote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            style={toolbarButtonStyle(editor.isActive("blockquote"))}
          >
            <Quote size={14} />
          </button>
          <button
            type="button"
            title="Code block"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            style={toolbarButtonStyle(editor.isActive("codeBlock"))}
          >
            <SquareCode size={14} />
          </button>
          <button
            type="button"
            title="Undo"
            disabled={!editor.can().chain().focus().undo().run()}
            onClick={() => editor.chain().focus().undo().run()}
            style={toolbarButtonStyle(false)}
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            title="Redo"
            disabled={!editor.can().chain().focus().redo().run()}
            onClick={() => editor.chain().focus().redo().run()}
            style={toolbarButtonStyle(false)}
          >
            <Redo2 size={14} />
          </button>
        </div>
      ) : null}
      <EditorContent
        editor={editor}
        className="wiki-richtext-editor"
        style={{
          minHeight,
          padding: "14px 16px",
          color: "var(--wiki-article-text)",
        }}
      />
    </div>
  );
}
