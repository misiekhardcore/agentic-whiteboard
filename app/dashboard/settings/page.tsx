import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@konopskidev/ui/components/badge";
import { Button } from "@konopskidev/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import { getSessionAccount } from "@/lib/account";
import { canManageTeam } from "@/lib/organizations";

import {
  OrganizationProfileForm,
  PersonalProfileForm,
} from "./_components/profile-forms";

export const metadata = {
  title: "Settings",
};

// The page depends on the signed-in session and the active account.
export const instant = false;

export default async function SettingsPage() {
  const account = await getSessionAccount();
  if (!account) redirect("/sign-in?redirectTo=/dashboard/settings");

  const { teams, activeTeam, session } = account;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h2 font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal profile and the organization you are
          using. Use the account menu on your avatar to switch between
          them.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Personal account</CardTitle>
          <CardDescription>
            This name and photo appear in the header and anywhere your
            account is shown to teammates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PersonalProfileForm
            user={{
              name: session.user.name,
              email: session.user.email,
              image: session.user.image ?? null,
            }}
          />
        </CardContent>
      </Card>

      {activeTeam ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{activeTeam.name}</CardTitle>
              <Badge variant="outline" className="capitalize">
                {activeTeam.role}
              </Badge>
            </div>
            <CardDescription>
              Organization profile · {activeTeam.memberCount}{" "}
              {activeTeam.memberCount === 1 ? "member" : "members"}.
              Members and billing live on the{" "}
              <Link
                href="/dashboard/team"
                className="underline underline-offset-4 hover:text-foreground"
              >
                team page
              </Link>
              .
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Organization profile</CardTitle>
            <CardDescription>
              You are using your personal account. Organizations you
              belong to appear in the account menu on your avatar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/team">Manage teams</Link>
            </Button>
            {teams.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Switch to one of your {teams.length}{" "}
                {teams.length === 1 ? "organization" : "organizations"}{" "}
                to edit its profile.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
