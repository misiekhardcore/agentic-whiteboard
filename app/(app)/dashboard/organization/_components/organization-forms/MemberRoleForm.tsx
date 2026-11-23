"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@konopskidev/ui/components/select";
import { useState, useTransition } from "react";

import { updateMemberRoleAction } from "@/lib/organizations/actions";

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
