import { randomUUID } from "node:crypto";

import { actorReference, planDocBatch, RoomOwnerError } from "@v2/contracts";
import type {
  Actor,
  ContentOp,
  DocBlock,
  DocBlockWrite,
  DocPlanStep,
  DocProjection,
} from "@v2/contracts";
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

/** The explicit identity every block carries; it is never an offset. */
function blockIdOf(element: Y.XmlElement): string | null {
  const explicit: unknown = element.getAttribute("blockId");
  return typeof explicit === "string" && explicit.length > 0 ? explicit : null;
}

function blockOf(element: Y.XmlElement): DocBlock {
  const id = blockIdOf(element);
  if (id === null) {
    throw new Error("A document block has no blockId; assign one before projecting the document.");
  }

  const updatedBy: unknown = element.getAttribute("updatedBy");

  return {
    id,
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
    .flatMap((node) => (node instanceof Y.XmlElement ? [blockOf(node)] : []));
}

export function projectDocContent(doc: Y.Doc): DocProjection {
  return { blocks: projectBlocks(doc.getXmlFragment(DOC_BLOCKS_FIELD)) };
}

/**
 * Gives every block that predates the explicit attribute one stable id. This
 * runs once when a room loads, before anyone projects or edits the document,
 * and the caller persists the migrated state.
 */
export function ensureBlockIds(doc: Y.Doc): boolean {
  const fragment = doc.getXmlFragment(DOC_BLOCKS_FIELD);
  const missing = fragment
    .toArray()
    .some((node) => node instanceof Y.XmlElement && blockIdOf(node) === null);

  if (!missing) return false;

  doc.transact(() => {
    for (const node of fragment.toArray()) {
      if (node instanceof Y.XmlElement && blockIdOf(node) === null) {
        node.setAttribute("blockId", `block_${randomUUID()}`);
      }
    }
  }, "assign-block-ids");

  return true;
}

function findBlockElement(fragment: Y.XmlFragment, blockId: string): Y.XmlElement | null {
  for (const node of fragment.toArray()) {
    if (node instanceof Y.XmlElement && blockIdOf(node) === blockId) return node;
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

function applyStep(fragment: Y.XmlFragment, step: DocPlanStep, writtenBy: string): void {
  if (step.kind === "append") {
    fragment.push([createBlockElement(step.block, writtenBy)]);
    return;
  }

  const { blockId, block } = step;
  const target = findBlockElement(fragment, blockId);
  if (target === null) {
    throw new RoomOwnerError("invalid-ops", `Block ${blockId} disappeared while applying`);
  }

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
    throw new RoomOwnerError("invalid-ops", `Block ${blockId} disappeared while applying`);
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
  const plan = planDocBatch(projectDocContent(doc), input.ops);
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
