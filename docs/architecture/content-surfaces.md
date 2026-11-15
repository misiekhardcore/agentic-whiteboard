# Documents and canvases as content surfaces

Status: accepted
Date: 2026-11-15

## Context

A workspace has two content surfaces: at most one document and at most one
canvas, each holding a `workspaceId` that is unique in the schema. The tables
predate this record, but nothing owned them. `lib/workspace/recent.ts` joined
both from the workspace side to build the dashboard's latest-items list, so the
workspace context knew the shape of two tables it does not own, and the two
surfaces had no place to put a rule of their own when the editor arrives.

[module-boundaries](module-boundaries.md) deferred them: "they appear with the
Hocuspocus gateway and their snapshot/mutate capability family". This record
takes the structural half of that now, while the tables have exactly one reader
and the move costs nothing. The mutation half still waits for the editor.

## Decisions

| Area         | Decision                                                                                              | Why                                                                                                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contexts     | `lib/doc` and `lib/canvas`, one per surface                                                           | They share a shape today, not a reason to change: a document carries Yjs state and is edited as text, the canvas is edited as shapes. A `kind` column would grow a branch in every query the moment they diverge.                                                  |
| Ownership    | The document and canvas contexts own their tables, contracts and reads; nothing else reads them       | A context that queries another's table is coupled to a schema it does not own, and the type system cannot see it.                                                                                                                                                  |
| Reachability | A surface is reachable exactly when its workspace is; the surface contexts take workspace ids         | The account scope and the archive flag belong to the workspace context. Passing ids keeps one place that decides what a person may see, instead of two predicates that can disagree.                                                                               |
| Composition  | The workspace read model composes the published reads instead of joining the tables                   | The join was the coupling. `composeRecentItems` is pure, so the rule — a surface borrows its workspace's name and stage, and is dropped when that workspace is out of scope — is tested without a database.                                                        |
| Naming       | A surface has no name, stage or description of its own                                                | It reads through its workspace in the list, the link and (later) the editor title. An "Untitled doc" would be a second name for something the person already named.                                                                                                |
| Capabilities | None yet; the first family lands with the editor                                                      | A capability without a mutation is a record nobody invokes and an option nobody can use. The agent gains `createDoc`/`updateDocContent` (and canvas equivalents) when there is content to write, with `callers: ["human"]` until promotion is a deliberate review. |
| Access       | No `access.ts` in either context                                                                      | Authorization is the workspace's answer, and `getWorkspaceForUser` already returns it. A second check here would be a second chance to disagree.                                                                                                                   |
| Enforcement  | Lint zone and `lib/architecture.test.ts` keep the surfaces dependent on nothing but `db` and `shared` | The split is only worth having while the arrow points one way; a surface importing a context recreates the cycle it removed.                                                                                                                                       |

### Why the ledger read did not become a capability

`listRecentWorkspaceItems` is a read model over three contexts. The capability
kernel exists to make one _mutation_ safe for two callers; a read has no
authorization to remember, no revalidation to schedule and no approval to pause.
A capability record here would add a schema and a wrapper around a function the
dashboard calls once.

## Structure

```text
lib/
  workspace/
    queries.ts      the account's workspaces (scope + archive flag)
    recent.ts       composeRecentItems: workspaces + surfaces → one list
  doc/
    contracts.ts    DocSurface
    queries.ts      listDocSurfaces(workspaceIds)
  canvas/
    contracts.ts    CanvasSurface
    queries.ts      listCanvasSurfaces(workspaceIds)
```

The dependency direction:

```text
workspace/recent.ts ──► doc/queries.ts
        │           └─► canvas/queries.ts
        ▼
workspace/queries.ts ──► db
```

## Consequences

- The dashboard's latest-items list runs three plain selects instead of one
  select with two inner joins. The surface queries are skipped entirely when the
  account has no workspaces.
- Archiving a workspace still removes its doc and canvas from the list, but now
  because the workspace list is the only source of the ids, not because both
  predicates happen to match.
- A surface whose workspace disappears between the two reads is dropped rather
  than rendered nameless, and that case has a test.
- Adding the editor means adding a capability and a route, not editing the
  workspace context.

## Deferred

- The content mutation family: `createDoc`, `updateDocContent`, `deleteDoc` and
  the canvas equivalents, with the approval rule the workspace archive/delete
  capabilities use for destructive ones.
- The document snapshot rule (Yjs state versus `content` JSON) and the canvas
  layout invariant, which belong to the collaboration gateway.
- Per-surface sharing: a `shareToken` per surface, or the workspace's token
  extended, as a capability with `callers: ["human"]`.
