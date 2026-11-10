"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Input } from "@konopskidev/ui/components/input";
import { Label } from "@konopskidev/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@konopskidev/ui/components/select";
import { useState, useTransition } from "react";
import { useActionState } from "react";

import {
  createTeamAction,
  inviteMemberAction,
  switchTeamAction,
  updateMemberRoleAction,
} from "@/lib/organization-actions";
import { EMPTY_TEAM_FORM_STATE } from "@/lib/organization-form";
import type { TeamOption } from "@/lib/organizations";

export function CreateTeamForm() {
  const [state, formAction, pending] = useActionState(
    createTeamAction,
    EMPTY_TEAM_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="team-name">Team name</Label>
        <Input
          id="team-name"
          name="name"
          placeholder="Product design"
          autoComplete="organization"
          required
        />
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create team"}
      </Button>
    </form>
  );
}

export function SwitchTeamForm({
  teams,
  activeOrganizationId,
}: {
  teams: TeamOption[];
  activeOrganizationId: string;
}) {
  return (
    <form
      action={switchTeamAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="active-team">Active team</Label>
        <Select name="organizationId" defaultValue={activeOrganizationId}>
          <SelectTrigger id="active-team" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline">
        Switch
      </Button>
    </form>
  );
}

export function InviteMemberForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    inviteMemberAction,
    EMPTY_TEAM_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            className="h-9"
            placeholder="teammate@company.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <Select name="role" defaultValue="member">
            <SelectTrigger
              id="invite-role"
              className="h-9 w-full data-[size=default]:h-9"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="h-9" disabled={pending}>
          {pending ? "Sending…" : "Invite"}
        </Button>
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.notice ? (
        <Alert>
          <AlertDescription>{state.notice}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}

/**
 * Changing a role saves on selection: owners and admins pick member or admin
 * and the row is revalidated from the server, so the badge always shows stored
 * state rather than an optimistic guess.
 */
export function MemberRoleForm({
  memberId,
  organizationId,
  role,
}: {
  memberId: string;
  organizationId: string;
  role: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(nextRole: string) {
    const data = new FormData();
    data.set("memberId", memberId);
    data.set("organizationId", organizationId);
    data.set("role", nextRole);

    setError(null);
    startTransition(async () => {
      const result = await updateMemberRoleAction(data);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Select defaultValue={role} onValueChange={change} disabled={pending}>
        <SelectTrigger
          aria-label="Role"
          className="h-9 w-28 data-[size=default]:h-9"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">Member</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * The Stripe billing portal is the only cancellation path, so it is a plain
 * button that asks the server for a fresh session URL.
 */
export function ManageBillingButton({
  organizationId,
  label = "Manage billing",
}: {
  organizationId?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(organizationId ? { organizationId } : {}),
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not open the billing portal.");
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant="outline" onClick={openPortal} disabled={loading}>
        {loading ? "Opening…" : label}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
