import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { switchTeamAction } from "@/lib/organizations/actions";
import type { TeamOption } from "@/lib/organizations/contracts";

import { CreateOrganizationForm } from "./organization-forms";

export function PersonalOrganizationsView({ teams }: { teams: TeamOption[] }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h2 font-semibold">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          You&rsquo;re using your personal account, which has no members. Create an organization to
          invite people, or open one you belong to from the account menu on your avatar.
        </p>
      </header>

      {teams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your organizations</CardTitle>
            <CardDescription>
              Open one from the account menu on your avatar to manage its members and billing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {teams.map((option) => (
                <li
                  key={option.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{option.name}</p>
                    <p className="truncate text-xs text-muted-foreground capitalize">
                      {option.role} · {option.memberCount}{" "}
                      {option.memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                  <form action={switchTeamAction}>
                    <input type="hidden" name="organizationId" value={option.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Manage
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New organization</CardTitle>
          <CardDescription>
            You become its owner. It opens right away, so you can invite people next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </div>
  );
}
