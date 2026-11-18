import { Badge } from "@konopskidev/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { removeMemberAction } from "@/lib/organizations/actions";
import type { TeamMember } from "@/lib/organizations/contracts";

import { InviteMemberForm, MemberRoleForm } from "./organization-forms";

export function MembersCard({
  members,
  organizationId,
  currentUserId,
  canManage,
}: {
  members: TeamMember[];
  organizationId: string;
  currentUserId: string;
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Seats on a paid plan follow the member count automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="flex flex-col divide-y">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {member.name}
                  {member.userId === currentUserId ? " (you)" : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canManage && member.userId !== currentUserId && member.role !== "owner" ? (
                  <MemberRoleForm
                    memberId={member.id}
                    organizationId={organizationId}
                    role={member.role}
                  />
                ) : (
                  <Badge variant="outline" className="capitalize">
                    {member.role}
                  </Badge>
                )}
                {canManage && member.userId !== currentUserId && (
                  <ConfirmAction
                    action={removeMemberAction}
                    fields={{ memberId: member.id, organizationId }}
                    title={`Remove ${member.name}?`}
                    description={`${member.email} loses access to this organization right away. On a paid plan the seat is dropped and Stripe prorates the difference.`}
                    confirmLabel="Remove member"
                    pendingLabel="Removing…"
                    triggerLabel="Remove"
                    triggerVariant="destructive"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>

        {canManage && (
          <div className="border-t pt-5">
            <InviteMemberForm organizationId={organizationId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
