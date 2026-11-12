import { EmptyState } from "@/components/EmptyState/EmptyState";
import { Loading } from "@/components/Loading/Loading";
import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { getSessionAccount } from "@/lib/account";
import { archiveWorkspaceAction } from "@/lib/workspace-actions";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace-status";
import { listAccountWorkspaces } from "@/lib/workspaces";
import { Folder } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CreateNewBoardDialog } from "./CreateNewBoardDialog";
import { EditBoardDialog } from "./EditBoardDialog";

export function ProjectsList() {
  return (
    <Suspense fallback={<Loading />}>
      <ProjectsListInner />
    </Suspense>
  );
}

async function ProjectsListInner() {
  const account = await getSessionAccount();

  if (!account) return null;

  const { activeTeam, session } = account;
  const accountName = activeTeam?.name ?? "Personal account";
  const boards = await listAccountWorkspaces(
    session.user.id,
    activeTeam?.id ?? null,
  );

  if (boards.length === 0) {
    return (
      <EmptyState
        icon={
          <Folder height={64} width={64} className="text-primary" />
        }
        title={`No boards in ${accountName}`}
        description={
          activeTeam
            ? `Boards shared with ${activeTeam.name} will appear here.`
            : "You haven't created any personal boards yet."
        }
        action={
          <CreateNewBoardDialog size="sm" variant="outline" />
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-bold">{accountName} boards</h2>
        <p className="text-sm text-muted-foreground">
          {boards.length} {boards.length === 1 ? "board" : "boards"} in
          this account.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {boards.map((board) => (
          <li
            key={board.id}
            className="card flex h-full flex-col gap-3 p-4 transition-colors hover:border-primary/40"
          >
            <Link
              href={`/workspace/${board.id}`}
              className="flex flex-col gap-2"
            >
              <span className="font-medium">{board.name}</span>
              {board.description && (
                <span className="line-clamp-2 text-sm text-muted-foreground">
                  {board.description}
                </span>
              )}
            </Link>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                {WORKSPACE_STATUS_LABELS[board.status]}
              </span>

              <div className="flex items-center gap-2">
                <EditBoardDialog
                  id={board.id}
                  name={board.name}
                  description={board.description}
                  status={board.status}
                />
                <ConfirmAction
                  action={archiveWorkspaceAction}
                  fields={{ id: board.id }}
                  title={`Archive ${board.name}?`}
                  description="The board leaves the dashboard and stops counting against your plan. Its documents, canvas and agent history are kept, and you can restore it at any time."
                  confirmLabel="Archive board"
                  pendingLabel="Archiving…"
                  triggerLabel="Archive"
                  triggerVariant="ghost"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
