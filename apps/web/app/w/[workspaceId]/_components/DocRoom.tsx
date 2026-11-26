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

  const provider = useMemo(
    () =>
      new HocuspocusProvider({
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
      }),
    [initialConnection, workspaceId, ydoc],
  );

  useEffect(
    () => () => {
      provider.destroy();
      ydoc.destroy();
    },
    [provider, ydoc],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: ydoc }),
      ],
      editable: !connectionReadOnly,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: "doc-body", "aria-label": "Document" },
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
    <div className="doc-shell">
      <div className="doc-bar">
        <DocToolbar editor={editor} readOnly={connectionReadOnly} />
        <DocConnectionLine status={status} readOnly={connectionReadOnly} />
      </div>
      <div className="doc-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
