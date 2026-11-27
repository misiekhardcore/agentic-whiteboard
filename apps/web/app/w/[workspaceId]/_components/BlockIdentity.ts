import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

let assigning = false;

function newBlockId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `block_${random}`;
}

/**
 * Assigns an id after a transaction that created a top-level block. A split
 * block can inherit its neighbour's id, so a duplicate is repaired as well as
 * a missing one. The guard matters because dispatching the repair transaction
 * runs this hook again; the second pass sees unique ids and does nothing.
 */
function assignBlockIds(editor: Editor): void {
  if (assigning) return;

  const transaction = editor.state.tr;
  const seen = new Set<string>();
  let changed = false;

  editor.state.doc.forEach((node, offset) => {
    if (node.type.name !== "paragraph" && node.type.name !== "heading") return;

    const blockId: unknown = node.attrs.blockId;
    if (typeof blockId === "string" && blockId.length > 0 && !seen.has(blockId)) {
      seen.add(blockId);
      return;
    }

    transaction.setNodeMarkup(offset, undefined, { ...node.attrs, blockId: newBlockId() });
    changed = true;
  });

  if (!changed) return;

  transaction.setMeta("addToHistory", false);
  assigning = true;
  try {
    editor.view.dispatch(transaction);
  } finally {
    assigning = false;
  }
}

/**
 * Blocks carry a stable `blockId`, and every server write records its actor.
 * The editor has to declare both attributes or the sync plugin drops them the
 * first time a person edits the block. It also assigns an id to every block a
 * person creates, so the room never reads an identity out of Yjs internals.
 */
export const BlockIdentity = Extension.create({
  name: "blockIdentity",

  onCreate() {
    assignBlockIds(this.editor);
  },

  onTransaction({ transaction }) {
    if (transaction.docChanged) assignBlockIds(this.editor);
  },

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) =>
              typeof attributes.blockId === "string" && attributes.blockId.length > 0
                ? { "data-block-id": attributes.blockId }
                : {},
          },
          updatedBy: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-updated-by"),
            renderHTML: (attributes) =>
              typeof attributes.updatedBy === "string" && attributes.updatedBy.length > 0
                ? { "data-updated-by": attributes.updatedBy }
                : {},
          },
        },
      },
    ];
  },
});
