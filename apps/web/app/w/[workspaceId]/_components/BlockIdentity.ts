import { Extension } from "@tiptap/core";

/**
 * Server-written blocks carry a stable `blockId`, and every server write
 * records its actor. The editor has to declare both attributes or the sync
 * plugin drops them the first time a person edits the block.
 */
export const BlockIdentity = Extension.create({
  name: "blockIdentity",

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
