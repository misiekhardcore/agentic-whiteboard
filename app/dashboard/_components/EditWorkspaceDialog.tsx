"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@konopskidev/ui/components/dialog";
import { Input } from "@konopskidev/ui/components/input";
import { Label } from "@konopskidev/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@konopskidev/ui/components/select";
import { Textarea } from "@konopskidev/ui/components/textarea";
import { Pencil } from "lucide-react";
import { useActionState, useCallback, useEffect, useState } from "react";

import { updateWorkspaceAction } from "@/lib/workspace-actions";
import { EMPTY_WORKSPACE_FORM_STATE, WORKSPACE_DESCRIPTION_MAX_LENGTH } from "@/lib/workspace-form";
import {
  WORKSPACE_STATUS_LABELS,
  WORKSPACE_STATUSES,
  type WorkspaceStatus,
} from "@/lib/workspace-status";

/**
 * Renaming a workspace and moving it between stages. The workspace id is the
 * only identifier the server trusts; the caller's access to that workspace's
 * account is re-checked by the action.
 */
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

function EditWorkspaceForm({
  id,
  name,
  description,
  status,
  onDone,
}: {
  id: string;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateWorkspaceAction,
    EMPTY_WORKSPACE_FORM_STATE,
  );

  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="editWorkspaceName">Workspace name</Label>
        <Input
          type="text"
          id="editWorkspaceName"
          name="name"
          defaultValue={name}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="editWorkspaceDescription">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="editWorkspaceDescription"
          name="description"
          rows={3}
          defaultValue={description ?? ""}
          maxLength={WORKSPACE_DESCRIPTION_MAX_LENGTH}
          aria-invalid={Boolean(state.fieldErrors?.description)}
        />
        {state.fieldErrors?.description && (
          <p className="text-xs text-destructive">{state.fieldErrors.description}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="editWorkspaceStatus">Stage</Label>
        <Select name="status" defaultValue={status}>
          <SelectTrigger id="editWorkspaceStatus" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKSPACE_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {WORKSPACE_STATUS_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.status && (
          <p className="text-xs text-destructive">{state.fieldErrors.status}</p>
        )}
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
