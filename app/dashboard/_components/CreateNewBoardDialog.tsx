"use client";

import {
  Alert,
  AlertDescription,
} from "@konopskidev/ui/components/alert";
import { Button, ButtonProps } from "@konopskidev/ui/components/button";
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
import { Textarea } from "@konopskidev/ui/components/textarea";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";

import { createWorkspaceAction } from "@/lib/workspace-actions";
import {
  EMPTY_WORKSPACE_FORM_STATE,
  WORKSPACE_DESCRIPTION_MAX_LENGTH,
} from "@/lib/workspace-form";

/**
 * Creating a board belongs to the account the dashboard is showing: a personal
 * board outside any organization, or one shared with the active team. The quota
 * and the account are resolved server-side; the dialog only reports the result.
 */
export function CreateNewBoardDialog(buttonProps: ButtonProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen} modal>
      <DialogTrigger asChild>
        <Button {...buttonProps}>
          <Plus />
          Create new board
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create your new whiteboard</DialogTitle>
        </DialogHeader>
        {/* Mounted only while open, so a previous attempt's state resets. */}
        {open && <CreateBoardForm onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateBoardForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    createWorkspaceAction,
    EMPTY_WORKSPACE_FORM_STATE,
  );

  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="boardName">Board name</Label>
        <Input
          type="text"
          id="boardName"
          name="name"
          placeholder="My amazing board..."
          aria-invalid={Boolean(state.fieldErrors?.name)}
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="boardDescription">
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="boardDescription"
          name="description"
          rows={3}
          maxLength={WORKSPACE_DESCRIPTION_MAX_LENGTH}
          placeholder="What is this board for?"
          aria-invalid={Boolean(state.fieldErrors?.description)}
        />
        {state.fieldErrors?.description && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.description}
          </p>
        )}
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.limitReached && (
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/dashboard/billing">View plans</Link>
        </Button>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
