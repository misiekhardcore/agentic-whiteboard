import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { ConfirmAction } from "@/components/ConfirmAction/ConfirmAction";
import { cancelInvitationAction } from "@/lib/organizations/actions";
import type { PendingInvitation } from "@/lib/organizations/contracts";
import { formatDate } from "@/lib/shared/format-date";

export function PendingInvitationsCard({ invitations }: { invitations: PendingInvitation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>
          Invitations expire 48 hours after they are sent, and can be canceled here until they are
          accepted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <p className="text-xs text-muted-foreground">None right now.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {invitations.map((pending) => (
              <li
                key={pending.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{pending.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {pending.role ?? "member"} · expires {formatDate(pending.expiresAt)}
                  </p>
                </div>
                <ConfirmAction
                  action={cancelInvitationAction}
                  fields={{ invitationId: pending.id }}
                  title={`Cancel the invitation to ${pending.email}?`}
                  description="The link in that invitation stops working. You can send a new one at any time."
                  confirmLabel="Cancel invitation"
                  pendingLabel="Canceling…"
                  cancelLabel="Keep invitation"
                  triggerLabel="Cancel"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
