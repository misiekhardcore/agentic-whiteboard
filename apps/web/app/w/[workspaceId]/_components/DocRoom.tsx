"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

import { requestDocConnection } from "./doc-connection";
import type { DocConnection } from "./doc-connection";
import { DocConnectionLine } from "./DocConnectionLine";
import type { DocConnectionStatus } from "./DocConnectionLine";
import { DocToolbar } from "./DocToolbar";

/**
 * The editor itself, mounted only in the browser. The room decides read-only
 * from the token; the editor follows that answer, so an archived workspace's
 * toolbar is disabled and the reason is shown.
 */
export function DocRoom({
  workspaceId,
  readOnly,
  initialConnection,
}: {
  workspaceId: string;
  readOnly: boolean;
  initialConnection: DocConnection;
}) {
  const ydoc = useMemo(() => new Y.Doc(), []);
  const [status, setStatus] = useState<DocConnectionStatus>("connecting");
  const [connectionReadOnly, setConnectionReadOnly] = useState(
    readOnly || initialConnection.readOnly,
  );
  const [, setRevisionTick] = useState(0);

  // The provider owns a socket, so it is created and destroyed with the
  // effect. The Y.Doc outlives it: StrictMode mounts effects twice in
  // development, and destroying the shared document would leave the editor
  // typing into a document no provider is listening to.
  useEffect(() => {
    const provider = new HocuspocusProvider({
      url: initialConnection.url,
      name: initialConnection.documentName,
      document: ydoc,
      // Every attempt, including the first, asks for a fresh token, so an
      // expired one never travels and an archived workspace is re-answered
      // read-only after the room closes its live sessions.
      token: async () => {
        const connection = await requestDocConnection(workspaceId);
        setConnectionReadOnly(connection.readOnly);
        return connection.token;
      },
      onStatus: ({ status: next }) => setStatus(next),
      onAuthenticationFailed: () => setStatus("disconnected"),
    });

    return () => {
      provider.destroy();
    };
  }, [initialConnection, workspaceId, ydoc]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: ydoc }),
      ],
      editable: !connectionReadOnly,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: "doc-body prose-article", "aria-label": "Document" },
      },
    },
    [ydoc],
  );

  useEffect(() => {
    editor?.setEditable(!connectionReadOnly);
  }, [editor, connectionReadOnly]);

  // Tiptap does not re-render on a transaction on its own; the toolbar reads
  // the active marks from the editor, so the page asks it to re-read them.
  useEffect(() => {
    if (editor === null) return;

    const update = () => setRevisionTick((tick) => tick + 1);
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
        <DocToolbar editor={editor} readOnly={connectionReadOnly} />
        <DocConnectionLine status={status} readOnly={connectionReadOnly} />
      </div>
      <div className="doc-editor flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
