import { actorReference, readDocContentOp, RoomOwnerError } from "@v2/contracts";
import type { Actor, ContentOp, DocBlock, DocBlockWrite, DocProjection } from "@v2/contracts";
import * as Y from "yjs";

/** The Yjs XML fragment Tiptap edits. */
export const DOC_BLOCKS_FIELD = "default";

/** Request keys are recorded here, inside the document, with the operations. */
export const DOC_APPLIED_OPS = "appliedOps";

/** Room-level values: the content revision and whether the room was revoked. */
export const DOC_META = "meta";

const META_REVISION = "revision";
const META_REVOKED = "revoked";

type ApplyOutcome = { revision: number; applied: number };

type PlanStep =
  | { kind: "append"; block: DocBlockWrite }
  | { kind: "replace"; target: Y.XmlElement; block: DocBlockWrite };

/** The room's content revision, stored in the document so it survives unload. */
export function revisionOf(doc: Y.Doc): number {
  const revision = doc.getMap(DOC_META).get(META_REVISION);
  return typeof revision === "number" ? revision : 0;
}

export function isRevoked(doc: Y.Doc): boolean {
  return doc.getMap(DOC_META).get(META_REVOKED) === true;
}

/** Revocation is durable: a room that refused writes keeps refusing them. */
export function revokeDoc(doc: Y.Doc): void {
  doc.transact(() => {
    doc.getMap(DOC_META).set(META_REVOKED, true);
  }, "revoke");
}

function setHeadingLevel(element: Y.XmlElement, level: number): void {
  // The schema's heading level is a number. Yjs stores the value verbatim, and
  // y-tiptap hands element attributes straight to ProseMirror.
  (element as Y.XmlElement<Record<string, string | number>>).setAttribute("level", level);
}

function textOf(node: Y.XmlElement | Y.XmlText): string {
  if (node instanceof Y.XmlText) return String(node.toString());

  return node
    .toArray()
    .map((child) => {
      if (child instanceof Y.XmlText || child instanceof Y.XmlElement) return textOf(child);
      return "";
    })
    .join("");
}

function headingLevelOf(element: Y.XmlElement): number | null {
  const raw: unknown = element.getAttribute("level");
  const level = typeof raw === "number" ? raw : Number(raw);

  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : null;
}

/**
 * A block identity is the explicit id the server wrote, or — for a block a
 * person created in the editor — the Yjs item that holds it. Both survive
 * edits above and below the block; neither is an offset.
 */
function blockIdOf(element: Y.XmlElement, index: number): string {
  const explicit: unknown = element.getAttribute("blockId");
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  const item = element._item;
  return item === null ? `yjs-preliminary-${index}` : `yjs-${item.id.client}-${item.id.clock}`;
}

function blockOf(element: Y.XmlElement, index: number): DocBlock {
  const updatedBy: unknown = element.getAttribute("updatedBy");

  return {
    id: blockIdOf(element, index),
    kind: element.nodeName,
    level: element.nodeName === "heading" ? headingLevelOf(element) : null,
    text: textOf(element),
    updatedBy: typeof updatedBy === "string" && updatedBy.length > 0 ? updatedBy : null,
  };
}

/** The block projection every reader sees. Never raw CRDT bytes. */
export function projectBlocks(fragment: Y.XmlFragment): DocBlock[] {
  return fragment
    .toArray()
    .flatMap((node, index) => (node instanceof Y.XmlElement ? [blockOf(node, index)] : []));
}

export function projectDocContent(doc: Y.Doc): DocProjection {
  return { blocks: projectBlocks(doc.getXmlFragment(DOC_BLOCKS_FIELD)) };
}

function findBlockElement(fragment: Y.XmlFragment, blockId: string): Y.XmlElement | null {
  const elements = fragment.toArray();

  for (const [index, node] of elements.entries()) {
    if (!(node instanceof Y.XmlElement)) continue;
    if (blockIdOf(node, index) === blockId) return node;
  }

  return null;
}

/** Creates the Yjs node for one block, including its identity and attribution. */
export function createBlockElement(block: DocBlockWrite, writtenBy: string | null): Y.XmlElement {
  const element = new Y.XmlElement(block.kind);
  element.setAttribute("blockId", block.id);
  if (writtenBy !== null) element.setAttribute("updatedBy", writtenBy);
  if (block.kind === "heading") setHeadingLevel(element, block.level ?? 2);

  const text = new Y.XmlText();
  text.insert(0, block.text);
  element.insert(0, [text]);

  return element;
}

/**
 * Validates every operation before any is applied. A batch whose second
 * operation is invalid writes neither operation.
 */
function planDocOps(fragment: Y.XmlFragment, ops: readonly ContentOp[]): PlanStep[] {
  const steps: PlanStep[] = [];
  const blockIds = new Set(projectBlocks(fragment).map((block) => block.id));
  const replaced = new Set<Y.XmlElement>();

  for (const op of ops) {
    const parsed = readDocContentOp(op);
    if (parsed === null) {
      throw new RoomOwnerError(
        "invalid-ops",
        "The batch contains an operation this room cannot apply",
      );
    }

    if (parsed.kind === "append-block") {
      if (blockIds.has(parsed.payload.block.id)) {
        throw new RoomOwnerError("invalid-ops", `Block ${parsed.payload.block.id} already exists`);
      }

      blockIds.add(parsed.payload.block.id);
      steps.push({ kind: "append", block: parsed.payload.block });
      continue;
    }

    const target = findBlockElement(fragment, parsed.payload.blockId);
    if (target === null) {
      throw new RoomOwnerError("invalid-ops", `Block ${parsed.payload.blockId} does not exist`);
    }
    if (replaced.has(target)) {
      throw new RoomOwnerError("invalid-ops", `Block ${parsed.payload.blockId} is written twice`);
    }

    replaced.add(target);
    steps.push({ kind: "replace", target, block: parsed.payload.block });
  }

  return steps;
}

function applyStep(fragment: Y.XmlFragment, step: PlanStep, writtenBy: string): void {
  if (step.kind === "append") {
    fragment.push([createBlockElement(step.block, writtenBy)]);
    return;
  }

  const { target, block } = step;

  if (target.nodeName === block.kind) {
    target.delete(0, target.length);
    const text = new Y.XmlText();
    text.insert(0, block.text);
    target.insert(0, [text]);

    target.setAttribute("blockId", block.id);
    target.setAttribute("updatedBy", writtenBy);
    if (block.kind === "heading") setHeadingLevel(target, block.level ?? 2);
    else target.removeAttribute("level");
    return;
  }

  // Changing the node type is a replacement, not an edit: there is no way to
  // rename an XmlElement in place.
  const index = fragment.toArray().indexOf(target);
  if (index === -1) {
    throw new RoomOwnerError("invalid-ops", `Block ${block.id} disappeared while applying`);
  }

  fragment.delete(index, 1);
  fragment.insert(index, [createBlockElement(block, writtenBy)]);
}

/**
 * Applies one batch to a live document. The request key is recorded in the
 * document in the same transaction as the operations, so a replay is not just
 * detected — it changes nothing and returns the current revision.
 */
export function applyDocOps(
  doc: Y.Doc,
  input: { actor: Actor; idempotencyKey: string; ops: readonly ContentOp[] },
): ApplyOutcome {
  if (isRevoked(doc)) {
    throw new RoomOwnerError("room-revoked", "This document room was revoked");
  }

  const appliedOps = doc.getMap<number>(DOC_APPLIED_OPS);
  if (appliedOps.has(input.idempotencyKey)) {
    return { revision: revisionOf(doc), applied: 0 };
  }

  if (input.ops.length === 0) {
    return { revision: revisionOf(doc), applied: 0 };
  }

  const fragment = doc.getXmlFragment(DOC_BLOCKS_FIELD);
  const plan = planDocOps(fragment, input.ops);
  const writtenBy = actorReference(input.actor);
  let revision = revisionOf(doc);

  doc.transact(() => {
    for (const step of plan) applyStep(fragment, step, writtenBy);

    revision = revisionOf(doc) + 1;
    doc.getMap(DOC_META).set(META_REVISION, revision);
    appliedOps.set(input.idempotencyKey, revision);
  }, `apply:${writtenBy}`);

  return { revision, applied: plan.length };
}
