import { DOC_META_FIELD, DOC_REVISION_FIELD } from "@v2/contracts";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

import { revisionOf } from "./doc-blocks";
import { createRevisionTracker } from "./revision";
import type { RevisionTracker } from "./revision";

const trackers: RevisionTracker[] = [];

afterEach(() => {
  for (const tracker of trackers.splice(0)) tracker.dispose();
});

function trackerWith(debounceMs = 10): RevisionTracker {
  const tracker = createRevisionTracker({ debounceMs });
  trackers.push(tracker);
  return tracker;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typeInto(document: Y.Doc, text: string): void {
  document.getText("body").insert(0, text);
}

describe("the revision tracker", () => {
  it("counts one quiet burst as one revision, not one per keystroke", async () => {
    const document = new Y.Doc();
    const tracker = trackerWith();
    tracker.watch("doc-1", document);

    typeInto(document, "a");
    typeInto(document, "b");
    typeInto(document, "c");

    await wait(50);
    expect(revisionOf(document)).toBe(1);

    typeInto(document, "d");
    await wait(50);
    expect(revisionOf(document)).toBe(2);
  });

  it("does not count the room's own revision write or an apply batch", async () => {
    const document = new Y.Doc();
    const tracker = trackerWith();
    tracker.watch("doc-1", document);

    document.transact(() => {
      document.getMap(DOC_META_FIELD).set(DOC_REVISION_FIELD, 7);
    }, "revision");
    document.transact(() => {
      document.getText("body").insert(0, "from the server");
    }, "apply:user:user-1");
    document.transact(() => {
      document.getMap("meta").set("revoked", true);
    }, "revoke");

    await wait(50);
    expect(revisionOf(document)).toBe(7);
  });

  it("bumps pending changes immediately on a save and cancels the timer", async () => {
    const document = new Y.Doc();
    const tracker = trackerWith(1_000);
    tracker.watch("doc-1", document);

    typeInto(document, "unsaved");
    expect(tracker.flush("doc-1", document)).toBe(1);

    await wait(30);
    expect(revisionOf(document)).toBe(1);
  });

  it("reports the current revision when a save has nothing to count", () => {
    const document = new Y.Doc();
    const tracker = trackerWith();
    tracker.watch("doc-1", document);

    expect(tracker.flush("doc-1", document)).toBe(0);
  });

  it("stops counting a room it forgot", async () => {
    const document = new Y.Doc();
    const tracker = trackerWith();
    tracker.watch("doc-1", document);
    tracker.forget("doc-1");

    typeInto(document, "after unload");
    await wait(50);

    expect(revisionOf(document)).toBe(0);
  });
});
