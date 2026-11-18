"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { DialogClose, DialogFooter } from "@konopskidev/ui/components/dialog";
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
import { useActionState, useEffect } from "react";

import { updateWorkspaceAction } from "@/lib/workspace/actions";
import {
  EMPTY_WORKSPACE_FORM_STATE,
  WORKSPACE_DESCRIPTION_MAX_LENGTH,
} from "@/lib/workspace/forms";
import {
  WORKSPACE_STATUS_LABELS,
  WORKSPACE_STATUSES,
  type WorkspaceStatus,
} from "@/lib/workspace/status";

export function EditWorkspaceForm({
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
      <input type="hidden" name="workspaceId" value={id} />

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
