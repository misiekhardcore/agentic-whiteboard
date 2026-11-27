import { BLOCK_ID_PATTERN } from "@v2/contracts";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { DOC_BLOCKS_FIELD, ensureBlockIds, projectDocContent } from "./doc-blocks";

function legacyDoc(text: string): Y.Doc {
  const document = new Y.Doc();
  const element = new Y.XmlElement("paragraph");
  const content = new Y.XmlText();
  content.insert(0, text);
  element.insert(0, [content]);
  document.getXmlFragment(DOC_BLOCKS_FIELD).push([element]);

  return document;
}

describe("block identity", () => {
  it("assigns one stable id to a block that predates explicit ids", () => {
    const document = legacyDoc("Existing text");

    expect(() => projectDocContent(document)).toThrow(/blockId/);
    expect(ensureBlockIds(document)).toBe(true);

    const first = projectDocContent(document).blocks[0];
    expect(first?.id).toMatch(BLOCK_ID_PATTERN);

    expect(ensureBlockIds(document)).toBe(false);
    expect(projectDocContent(document).blocks[0]?.id).toBe(first?.id);

    document.destroy();
  });
});
