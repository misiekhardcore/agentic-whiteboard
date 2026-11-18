import { Badge } from "@konopskidev/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import type { TeamOption } from "@/lib/organizations/contracts";
import { canManageTeam } from "@/lib/organizations/membership";

import { OrganizationProfileForm, PersonalProfileForm } from "./profile-forms";

/**
 * The profile card for whichever account is active: the organization being
 * shown, or the person signed in.
 */
export function ProfileSection({
  activeTeam,
  user,
}: {
  activeTeam: TeamOption | null;
  user: { name: string; email: string; image: string | null };
}) {
  if (!activeTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personal account</CardTitle>
          <CardDescription>
            This name and photo appear in the header and anywhere your account is shown to
            teammates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PersonalProfileForm user={user} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{activeTeam.name}</CardTitle>
          <Badge variant="outline" className="capitalize">
            {activeTeam.role}
          </Badge>
        </div>
        <CardDescription>
          This name and photo appear wherever this organization is shown to its teammates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OrganizationProfileForm
          organization={{
            id: activeTeam.id,
            name: activeTeam.name,
            slug: activeTeam.slug,
            logo: activeTeam.logo,
          }}
          canManage={canManageTeam(activeTeam.role)}
        />
      </CardContent>
    </Card>
  );
}
