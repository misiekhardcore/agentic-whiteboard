"use client";

import { Button } from "@konopskidev/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@konopskidev/ui/components/dropdown-menu";
import { Ellipsis } from "lucide-react";
import { useState } from "react";

import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { archiveWorkspaceAction } from "@/lib/workspace/actions";
import type { WorkspaceStatus } from "@/lib/workspace/status";

import { EditWorkspaceDialog } from "./EditWorkspaceDialog";

/**
 * The card's management actions, one menu away on every surface. Edit opens its
 * dialog and Archive its confirmation from here, so the card itself carries no
 * second button row.
 */
export function WorkspaceCardMenu({
  id,
  name,
  description,
  status,
}: {
  id: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setArchiveOpen(true)}>
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditWorkspaceDialog
        id={id}
        name={name}
        description={description}
        status={status}
        open={editOpen}
        onOpenChange={setEditOpen}
        showTrigger={false}
      />

      <ConfirmAction
        action={archiveWorkspaceAction}
        fields={{ workspaceId: id }}
        title={`Archive ${name}?`}
        description="The workspace leaves the dashboard and stops counting against your plan. Its documents, canvas and agent history are kept, and you can restore it at any time."
        confirmLabel="Archive workspace"
        pendingLabel="Archiving…"
        triggerLabel="Archive"
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        showTrigger={false}
      />
    </>
  );
}
