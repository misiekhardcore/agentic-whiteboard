"use client";

import { Button } from "@konopskidev/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@konopskidev/ui/components/popover";
import { Separator } from "@konopskidev/ui/components/separator";
import { CreditCard, LogOut, Settings, Users } from "lucide-react";
import { useState, useTransition } from "react";

import { signOutAction } from "@/lib/identity/actions";
import { switchAccountAction } from "@/lib/organizations/actions";
import type { TeamOption } from "@/lib/organizations/contracts";
import { routes } from "@/lib/shared/routes";

import { AccountAvatar } from "./AccountAvatar";
import { AccountOption } from "./AccountOption";
import { MenuLink } from "./MenuLink";

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
  const [pendingOrganizationId, setPendingOrganizationId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeTeam = teams.find((team) => team.id === activeOrganizationId) ?? null;
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
          className="rounded-full p-0 hover:opacity-80"
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
            <p className="truncate text-xs text-muted-foreground capitalize">{currentDetail}</p>
          </div>
        </div>

        <Separator className="my-1" />

        <p className="p-1.5 text-xs text-muted-foreground uppercase">Switch account</p>

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

        {error && <p className="px-1.5 py-1 text-xs text-destructive">{error}</p>}

        <Separator className="my-1" />

        <MenuLink href={routes.dashboardSettings} onNavigate={() => setOpen(false)}>
          <Settings /> Account settings
        </MenuLink>
        <MenuLink href={routes.dashboardOrganization} onNavigate={() => setOpen(false)}>
          <Users />
          Organizations
        </MenuLink>
        <MenuLink href={routes.dashboardBilling} onNavigate={() => setOpen(false)}>
          <CreditCard />
          Billing
        </MenuLink>

        <Separator className="my-1" />

        <form action={signOutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="h-auto w-full justify-start gap-2.5 px-1.5 py-2 text-sm font-normal"
          >
            <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
            Sign out
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
