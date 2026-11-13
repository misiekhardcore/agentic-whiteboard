"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@konopskidev/ui/components/alert-dialog";
import { Button } from "@konopskidev/ui/components/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

/**
 * Destructive actions go through a confirmation dialog, so every caller needs
 * the same four things: the server action, the values identifying the row, the
 * question, and the button that starts it. Wrapping them here keeps the
 * wording and the danger styling consistent as more of these appear.
 *
 * The dialog waits for the action to finish before closing, so a failure leaves
 * the question on screen instead of silently dismissing it.
 */
export function ConfirmAction({
  action,
  fields,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  triggerLabel,
  triggerVariant = "destructive",
  triggerSize = "sm",
  triggerClassName,
  triggerIcon,
  confirmVariant = "destructive",
}: {
  /** A server action; called with the hidden fields as form data. */
  action: (formData: FormData) => Promise<void>;
  /** Values the action reads from the form, e.g. the member id. */
  fields: Record<string, string>;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerClassName?: string;
  triggerIcon?: ReactNode;
  confirmVariant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          {triggerIcon}
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* `contents` keeps the footer a direct grid child of the dialog. */}
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
          }}
          className="contents"
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <ConfirmButton
              variant={confirmVariant}
              label={confirmLabel}
              pendingLabel={pendingLabel ?? `${confirmLabel}…`}
            />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Disabled while the action runs so the same request is not sent twice. */
function ConfirmButton({
  variant,
  label,
  pendingLabel,
}: {
  variant: ButtonVariant;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
