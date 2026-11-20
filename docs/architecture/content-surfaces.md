# Documents and canvases as content surfaces

Status: accepted
Date: 2026-11-15
Revised: 2026-11-20

## Context

A workspace has at most one document and at most one canvas: rows in two tables,
each with a `workspaceId` unique in the schema. Nothing writes them until the
editor arrives, so the only decision to settle now is who reads them and what
keeps a second place from re-deciding reachability.

## Decisions

| Area         | Decision                                                                                                          | Why                                                                                                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contexts     | No `lib/doc` or `lib/canvas`; the read lives in `lib/workspace`                                                   | An earlier revision gave each surface its own context. Each then held one select and no rule of its own — the interface was the implementation, and the only rule it carried, reachability, belonged to the workspace. |
| Read         | One `listContentSurfaces(workspaceIds)` returns both tables, each row tagged                                      | It answers one question, so it is one module with one interface; a row already knows which surface it is, so no caller needs the two table shapes.                                                                     |
| Reachability | The read takes workspace ids the workspace context already authorized                                             | Account scope and the archive flag are the workspace's. A surface is reachable exactly when its workspace is, so archiving removes its surfaces without a second predicate that can disagree.                          |
| Enforcement  | `lib/architecture.test.ts` fails any module outside `lib/workspace` naming the two tables                         | A prose boundary erodes; naming the tables also catches a new module that reaches for them later.                                                                                                                      |
| Composition  | `composeRecentItems` borrows the workspace's name and stage; a surface whose workspace is out of scope is dropped | A surface has no name of its own, and the workspace list has already decided what is visible. The rule is pure, so it is tested without a database.                                                                    |
| Capabilities | None until the editor                                                                                             | A capability nobody can invoke yet is a record without a caller. `createDoc`/`updateDocContent` (and canvas equivalents) land with the content to write.                                                               |
| Access       | No second authorization check                                                                                     | `getWorkspaceForUser` already answered it; a check here would be a second chance to disagree.                                                                                                                          |

### Why the latest-items read is not a capability

The kernel makes one _mutation_ safe for two callers. A read has no
authorization to remember, no revalidation to schedule and no approval to pause,
so a capability record would wrap a function the dashboard calls once.

## Deferred

- The mutation family (`createDoc`, `updateDocContent`, `deleteDoc` and the
  canvas equivalents), when the editor and the Hocuspocus gateway exist.
- The document snapshot rule (Yjs state versus `content` JSON) and the canvas
  layout invariant, which belong to the collaboration gateway.
- Per-surface sharing: a `shareToken` per surface, or the workspace's extended.
