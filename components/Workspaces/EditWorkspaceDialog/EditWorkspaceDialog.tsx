"use client";

import { Button } from "@konopskidev/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@konopskidev/ui/components/dialog";
import { Pencil } from "lucide-react";
import { useCallback, useState } from "react";

import { type WorkspaceStatus } from "@/lib/workspace/status";

import { EditWorkspaceForm } from "./EditWorkspaceForm";

export function EditWorkspaceDialog({
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
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen} modal>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
        </DialogHeader>
        {open && (
          <EditWorkspaceForm
            id={id}
            name={name}
            description={description}
            status={status}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
