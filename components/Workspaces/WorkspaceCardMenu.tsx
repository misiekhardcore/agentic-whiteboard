"use client";

import { Button } from "@konopskidev/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@konopskidev/ui/components/dropdown-menu";
import { Ellipsis } from "lucide-react";
import { useState, useTransition } from "react";

import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import {
  archiveWorkspaceAction,
  deleteWorkspaceAction,
  restoreWorkspaceAction,
} from "@/lib/workspace/actions";
import type { WorkspaceStatus } from "@/lib/workspace/status";

import { EditWorkspaceDialog } from "./EditWorkspaceDialog";

/**
 * The card's management actions, one menu away on every surface. An active
 * workspace is edited and archived; an archived one is restored or deleted, so
 * no card offers an operation its state forbids. The dialogs open from here, so
 * the card carries no second button row.
 */
export function WorkspaceCardMenu({
  id,
  name,
  description,
  status,
  archived,
}: {
  id: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  archived: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoring, startRestore] = useTransition();

  const restore = () => {
    const formData = new FormData();
    formData.set("workspaceId", id);
    startRestore(async () => {
      await restoreWorkspaceAction(formData);
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {archived ? (
            <>
              <DropdownMenuItem disabled={restoring} onSelect={restore}>
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                Delete
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                Archive
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!archived && (
        <EditWorkspaceDialog
          id={id}
          name={name}
          description={description}
          status={status}
          open={editOpen}
          onOpenChange={setEditOpen}
          showTrigger={false}
        />
      )}

      {archived ? (
        <ConfirmAction
          action={deleteWorkspaceAction}
          fields={{ workspaceId: id }}
          title={`Delete ${name} permanently?`}
          description="The workspace and its documents, canvas and agent history are removed for good. This cannot be undone."
          confirmLabel="Delete workspace"
          pendingLabel="Deleting…"
          triggerLabel="Delete"
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          showTrigger={false}
        />
      ) : (
        <ConfirmAction
          action={archiveWorkspaceAction}
          fields={{ workspaceId: id }}
          title={`Archive ${name}?`}
          description="The workspace leaves the dashboard and stops counting against your plan. Its documents, canvas and agent history are kept, and you can restore it at any time."
          confirmLabel="Archive workspace"
          pendingLabel="Archiving…"
          triggerLabel="Archive"
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          showTrigger={false}
        />
      )}
    </>
  );
}
