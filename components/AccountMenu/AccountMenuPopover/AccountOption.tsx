"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { AccountAvatar } from "./AccountAvatar";

export function AccountOption({
  name,
  detail,
  image,
  organization = false,
  active,
  pending,
  onClick,
}: {
  name: string;
  detail: string;
  image: string | null;
  organization?: boolean;
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      disabled={pending}
      className={cn("px-1.5 py-2 text-left", active && "font-bold")}
    >
      <AccountAvatar name={name} image={image} organization={organization} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{name}</span>
        <span className="block truncate text-xs font-normal text-muted-foreground capitalize">
          {detail}
        </span>
      </span>
      {pending ? (
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : (
        active && <Check className="size-4 shrink-0" aria-hidden="true" />
      )}
    </Button>
  );
}
