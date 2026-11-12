import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { archiveWorkspaceAction } from "@/lib/workspace-actions";
import { WORKSPACE_STATUS_LABELS } from "@/lib/workspace-status";
import type { AccountWorkspace } from "@/lib/workspaces";
import Link from "next/link";

import { EditBoardDialog } from "./EditBoardDialog";

/**
 * A board in a list: its name and description link to the board, and the footer
 * carries the stage plus the management actions. Used by the dashboard's latest
 * list and by the all-boards page so both stay identical.
 */
export function BoardCard({ board }: { board: AccountWorkspace }) {
  return (
    <li className="card flex h-full flex-col gap-3 p-4 transition-colors hover:border-primary/40">
      <Link href={`/workspace/${board.id}`} className="flex flex-col gap-2">
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
  );
}
