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
import { useActionState } from "react";

import { inviteMemberAction } from "@/lib/organizations/actions";
import { EMPTY_TEAM_FORM_STATE } from "@/lib/organizations/forms";

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
