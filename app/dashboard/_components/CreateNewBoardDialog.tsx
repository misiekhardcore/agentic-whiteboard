"use client";
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
import { toast } from "@konopskidev/ui/components/sonner";
import { Plus } from "lucide-react";

export function CreateNewBoardDialog(buttonProps: ButtonProps) {
  return (
    <Dialog modal>
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast("", { closeButton: true });
          }}
          className="flex flex-col gap-4"
        >
          <Label htmlFor="boardName">Board name</Label>
          <Input
            type="text"
            id="boardName"
            name="boardName"
            placeholder="My amazing board..."
            required
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
