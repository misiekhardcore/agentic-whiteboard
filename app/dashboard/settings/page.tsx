import { Badge } from "@konopskidev/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";
import { redirect } from "next/navigation";

import { getSessionAccount } from "@/lib/identity/account";
import { readPersonalSettings } from "@/lib/identity/settings";
import { canManageTeam } from "@/lib/organizations/membership";
import { routes, signInPath } from "@/lib/shared/routes";

import { PreferencesForm } from "./_components/preferences-form";
import { OrganizationProfileForm, PersonalProfileForm } from "./_components/profile-forms";

export const metadata = {
  title: "Settings",
};

// The page depends on the signed-in session and the active account.
export const instant = false;

/**
 * Settings are scoped to the account the dashboard is showing, like the
 * organization and billing pages: with an organization active this edits it,
 * and with the personal account active it edits the person. The account menu in
 * the header switches between them, so two profiles are never edited blind on
 * one screen.
 */
export default async function SettingsPage() {
  const account = await getSessionAccount();
  if (!account) redirect(signInPath(routes.dashboardSettings));

  const { activeTeam, session } = account;
  // Preferences belong to the person, not the active account, so they are read
  // and edited the same way whichever profile is on screen.
  const settings = await readPersonalSettings(session.user.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h2 font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {activeTeam ? `Profile settings for ${activeTeam.name}.` : "Your personal profile."} Use
          the account menu on your avatar to switch between your personal account and your
          organizations.
        </p>
      </header>

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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Personal account</CardTitle>
            <CardDescription>
              This name and photo appear in the header and anywhere your account is shown to
              teammates.
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            These follow you across your personal account and every organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            initialReadAloud={settings.readAloud}
            initialReadAloudVoice={settings.readAloudVoice}
          />
        </CardContent>
      </Card>
    </div>
  );
}
