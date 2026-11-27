"use client";

import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type * as Y from "yjs";

import { BlockIdentity } from "./BlockIdentity";
import { DocToolbar } from "./DocToolbar";

/**
 * The editing surface, mounted only after the provider has synced. An editor
 * created against a still-empty document writes its own starting paragraph
 * into the shared document, which the room stores as a new block; two page
 * loads become two blocks. Waiting for the sync makes the first paragraph the
 * room's own.
 */
export function DocSurface({
  ydoc,
  readOnly,
  children,
}: {
  ydoc: Y.Doc;
  readOnly: boolean;
  children: ReactNode;
}) {
  const [, setTransactionTick] = useState(0);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        BlockIdentity,
        Collaboration.configure({ document: ydoc }),
      ],
      editable: !readOnly,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: "doc-body prose-article", "aria-label": "Document" },
      },
    },
    [ydoc],
  );

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Tiptap does not re-render on a transaction on its own; the toolbar reads
  // the active marks from the editor, so the page asks it to re-read them.
  useEffect(() => {
    if (editor === null) return;

    const update = () => setTransactionTick((tick) => tick + 1);
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);

    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  return (
    <div className="flex flex-col">
      <div className="doc-bar flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2">
        <DocToolbar editor={editor} readOnly={readOnly} />
        <div className="doc-bar-side">{children}</div>
      </div>
      <div className="doc-editor flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
