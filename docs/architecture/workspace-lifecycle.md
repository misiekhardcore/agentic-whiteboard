# Workspace lifecycle: archive, delete, and the agent's authority

Status: accepted
Date: 2026-11-13

## Context

A workspace could be created, edited (name, description, stage), archived and
restored — archive is a soft delete that hides it from the dashboard, frees its
plan slot and keeps its documents, canvas and agent history. Nothing could remove
a workspace for good, and the agent could only create one.

The dashboard was the only place to manage workspaces, so every operation the
agent lacked forced the person out of the conversation. Deleting was the one
operation that should stay there: it is irreversible, and a model that
mishears a workspace name should not be able to erase one.

## Decisions

| Area               | Decision                                                                                | Why                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Removal            | Two stages: archive, then delete                                                        | Archiving is reversible and is the confirmation that the workspace should leave the list; deleting is permanent and only allowed afterwards.                                                                    |
| Delete guard       | `archivedAt` must be set, checked in the catalog and repeated in the `DELETE`'s `WHERE` | A restore that lands between the check and the write makes the statement match nothing, so an active workspace cannot be deleted by a stale request.                                                            |
| Delete scope       | Edit permission on the workspace's own account                                          | Same authorization as every other mutation; the account comes from the workspace row, never from a request body or the model.                                                                                   |
| Delete effect      | The workspace row and, by cascade, its document, canvas and agent prompt history        | The schema already declares `onDelete: "cascade"`; a hard delete is meant to leave nothing behind.                                                                                                              |
| Agent writes       | Create, list, read, update, restore                                                     | These are the operations a conversation can carry out without asking.                                                                                                                                           |
| Agent removals     | Archive and delete are proposed, never executed unconfirmed                             | Both remove something the person can see, so the tool call parks and the person answers an Approve/Deny card before anything changes. The capability is `approval: "always"` ([capabilities](capabilities.md)). |
| Approval integrity | Approval requests are signed with `AI_TOOL_APPROVAL_SECRET`                             | The answer travels through the browser; without a signature a client could approve a request it was never shown. When the secret is unset the two tools are not offered.                                        |
| Restore            | Allowed to the agent                                                                    | It is the undo of the person's own archive action, not a removal.                                                                                                                                               |
| Partial update     | Every field optional; the current row supplies the rest                                 | A model that sends only a new name must not blank the description or reset the stage. The merged draft is validated once.                                                                                       |
| Links              | Every tool result that names a workspace includes its `link`                            | The agent answers with a markdown link to `/workspace/:id` instead of describing where it might be.                                                                                                             |
| Stop               | Every mutating tool forwards the run's abort signal                                     | A prompt the person stopped must not keep changing workspaces; the catalog checks the signal before it writes.                                                                                                  |

## Consequences

- Deleting is reachable from the archive list, and from the agent only after a
  person approves it. The server rule — not the UI — enforces the archived
  precondition, so an approval for an active workspace still fails.
- The agent can act on a workspace it found through `listWorkspaces`, but it
  never reaches one by guessing an id: a workspace in another account resolves to
  "could not be found".
- Workspace operations have one catalog (`lib/workspace-service.ts`) behind one
  capability registry ([capabilities](capabilities.md)), shared by the server
  actions and the tools, so quota, validation, permission and abort behaviour
  cannot drift between the human UI and the agent.
- An archived workspace still counts as "archived" while it is deleted; a
  request that deletes the same workspace twice reports "not found" rather than
  failing oddly.

## Deferred

- A retention window or trash for deleted workspaces.
- Bulk archive or delete.
- Audit trail for who deleted a workspace.
- Share links as a narrower capability than membership.
