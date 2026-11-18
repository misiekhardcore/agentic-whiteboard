"use client";

import { Button } from "@konopskidev/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@konopskidev/ui/components/dialog";
import { History } from "lucide-react";
import { useState } from "react";

import { ConversationHistoryList } from "./ConversationHistoryList";

export function ConversationHistory({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto rounded-full py-1 text-xs"
        >
          <History />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conversation history</DialogTitle>
          <DialogDescription>Every conversation you have had, newest first.</DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog, so each open reads the list again: a
            conversation started in another tab should be there. */}
        <ConversationHistoryList currentId={currentId} onSelect={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
