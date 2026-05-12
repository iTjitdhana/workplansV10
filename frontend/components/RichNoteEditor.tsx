"use client";
import React, { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

type RichNoteEditorProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  debounceMs?: number;
};

// Minimal TipTap wrapper focused on responsiveness and small feature set
const RichNoteEditor: React.FC<RichNoteEditorProps> = ({ value, onChange, className = "", placeholder = "พิมพ์หมายเหตุ...", debounceMs = 400 }) => {
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        dropcursor: { color: "#16a34a", width: 2 },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: {
        class: `tiptap prose prose-sm max-w-none focus:outline-none min-h-[72px] ${className}`,
        spellcheck: "false",
      },
    },
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Debounce parent updates to avoid re-rendering large pages per keystroke
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      const text = editor.getText();
      debounceTimerRef.current = setTimeout(() => {
        onChange(text);
      }, debounceMs);
    },
    onBlur: ({ editor }) => {
      // Flush latest value immediately when focus leaves editor
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      onChange(editor.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    // Only sync external value when editor is not focused to avoid jitter
    const current = editor.getText();
    const incoming = value || "";

    // Always allow external empty value to clear editor content.
    if (incoming === "") {
      if (!editor.isEmpty || current !== "") {
        editor.commands.clearContent(true);
      }
      return;
    }

    if (!editor.isFocused && incoming !== current) {
      editor.commands.setContent(incoming.replace(/\n/g, "<br>"));
    }
  }, [value, editor]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  if (!editor) return null;
  
  return (
    <div className="w-full border rounded-md px-3 py-2 bg-white hover:border-green-400 focus-within:ring-2 focus-within:ring-green-500 relative">
      {/* Fallback overlay placeholder for reliability */}
      {editor && editor.isEmpty && !editor.isFocused && (
        <div className="pointer-events-none absolute left-3 top-2 text-gray-400 select-none">
          {placeholder}
        </div>
      )}
      <EditorContent editor={editor} />
      <style jsx>{`
        /* Placeholder style: show hint text in gray until user types */
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af; /* gray-400 */
          float: left;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
};

export default RichNoteEditor;


