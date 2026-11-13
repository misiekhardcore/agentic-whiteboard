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
import { useActionState, useState, useTransition } from "react";

import {
  createOrganizationAction,
  inviteMemberAction,
  updateMemberRoleAction,
} from "@/lib/organization-actions";
import { EMPTY_TEAM_FORM_STATE } from "@/lib/organization-form";

/**
 * Creating an organization is only offered from the personal account: it makes
 * the new organization active and moves the dashboard into it, where every
 * later change is made.
 */
export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState(
    createOrganizationAction,
    EMPTY_TEAM_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="organization-name">Organization name</Label>
        <Input
          id="organization-name"
          name="name"
          placeholder="Product design"
          autoComplete="organization"
          required
        />
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}

export function InviteMemberForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(inviteMemberAction, EMPTY_TEAM_FORM_STATE);

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
            <SelectTrigger id="invite-role" className="h-9 w-full data-[size=default]:h-9">
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

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.notice && (
        <Alert>
          <AlertDescription>{state.notice}</AlertDescription>
        </Alert>
      )}
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
        <SelectTrigger aria-label="Role" className="h-9 w-28 data-[size=default]:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">Member</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
