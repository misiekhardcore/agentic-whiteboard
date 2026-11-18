"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@konopskidev/ui/components/avatar";
import { Building2 } from "lucide-react";

import { initials } from "@/lib/shared/initials";

export function AccountAvatar({
  name,
  image,
  organization = false,
  size = "default",
}: {
  name: string;
  image: string | null;
  organization?: boolean;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size} className="shrink-0">
      {image ? <AvatarImage src={image} alt={name} /> : null}
      <AvatarFallback>
        {organization ? <Building2 className="size-3.5" aria-hidden="true" /> : initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
