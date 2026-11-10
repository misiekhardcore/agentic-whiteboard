"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@konopskidev/ui/components/avatar";
import { Button } from "@konopskidev/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@konopskidev/ui/components/popover";
import { Separator } from "@konopskidev/ui/components/separator";
import {
  Building2,
  Check,
  Loader2,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { signOutAction } from "@/lib/auth-actions";
import { switchAccountAction } from "@/lib/organization-actions";
import type { TeamOption } from "@/lib/organizations";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function AccountMenuPopover({
  user,
  teams,
  activeOrganizationId,
}: {
  user: { name: string; email: string; image: string | null };
  teams: TeamOption[];
  activeOrganizationId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrganizationId, setPendingOrganizationId] = useState<
    string | null
  >(null);
  const [pending, startTransition] = useTransition();

  const activeTeam =
    teams.find((team) => team.id === activeOrganizationId) ?? null;
  const currentName = activeTeam?.name ?? user.name;
  const currentDetail = activeTeam
    ? `${activeTeam.role} · ${activeTeam.memberCount} ${
        activeTeam.memberCount === 1 ? "member" : "members"
      }`
    : user.email;

  function selectAccount(organizationId: string | null) {
    if (pending) return;

    setError(null);
    if (organizationId === activeOrganizationId) {
      setOpen(false);
      return;
    }

    setPendingOrganizationId(organizationId);
    const data = new FormData();
    if (organizationId) data.set("organizationId", organizationId);

    startTransition(async () => {
      const result = await switchAccountAction(data);
      setPendingOrganizationId(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          type="button"
          className="p-0 rounded-full hover:opacity-80"
          aria-label={`Account menu for ${currentName}`}
          title="Switch account"
        >
          <AccountAvatar
            name={currentName}
            image={activeTeam ? activeTeam?.logo : user.image}
            organization={Boolean(activeTeam)}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 gap-1 p-2">
        <div className="flex items-center gap-3 px-1.5 py-1.5">
          <AccountAvatar
            name={currentName}
            image={activeTeam?.logo ?? user.image}
            organization={Boolean(activeTeam)}
            size="lg"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{currentName}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">
              {currentDetail}
            </p>
          </div>
        </div>

        <Separator className="my-1" />

        <p className="p-1.5 text-xs text-muted-foreground uppercase">
          Switch account
        </p>

        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          <AccountOption
            name="Personal account"
            detail={user.email}
            image={user.image}
            active={!activeTeam}
            pending={pending && pendingOrganizationId === null}
            onClick={() => selectAccount(null)}
          />

          {teams.map((team) => (
            <AccountOption
              key={team.id}
              name={team.name}
              detail={`${team.role} · ${team.memberCount} ${
                team.memberCount === 1 ? "member" : "members"
              }`}
              image={team.logo}
              organization
              active={team.id === activeOrganizationId}
              pending={pending && pendingOrganizationId === team.id}
              onClick={() => selectAccount(team.id)}
            />
          ))}
        </div>

        {error ? (
          <p className="px-1.5 py-1 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <Separator className="my-1" />

        <MenuLink
          href="/dashboard/settings"
          onNavigate={() => setOpen(false)}
        >
          <Settings /> Account settings
        </MenuLink>
        <MenuLink
          href="/dashboard/team"
          onNavigate={() => setOpen(false)}
        >
          <Users />
          Team &amp; billing
        </MenuLink>

        <Separator className="my-1" />

        <form action={signOutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="h-auto w-full justify-start gap-2.5 px-1.5 py-2 text-sm font-normal"
          >
            <LogOut
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Sign out
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function AccountOption({
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
      <AccountAvatar
        name={name}
        image={image}
        organization={organization}
        size="sm"
      />
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
      ) : active ? (
        <Check className="size-4 shrink-0" aria-hidden="true" />
      ) : null}
    </Button>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      className="px-1.5 py-2 justify-start"
      onClick={onNavigate}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function AccountAvatar({
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
        {organization ? (
          <Building2 className="size-3.5" aria-hidden="true" />
        ) : (
          initials(name)
        )}
      </AvatarFallback>
    </Avatar>
  );
}
