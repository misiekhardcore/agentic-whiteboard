import { redirect } from "next/navigation";

import { RefreshOnChanges } from "@/components/Changes";
import { getSessionAccount } from "@/lib/identity/account";
import { readPersonalSettings } from "@/lib/identity/settings";
import { CHANGE_KEYS } from "@/lib/shared/changes";
import { routes, signInPath } from "@/lib/shared/routes";

import { PreferencesSection } from "./_components/PreferencesSection";
import { ProfileSection } from "./_components/ProfileSection";

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
      <RefreshOnChanges keys={[CHANGE_KEYS.account, CHANGE_KEYS.settings]} />
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h2 font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {activeTeam ? `Profile settings for ${activeTeam.name}.` : "Your personal profile."} Use
          the account menu on your avatar to switch between your personal account and your
          organizations.
        </p>
      </header>

      <ProfileSection
        activeTeam={activeTeam}
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
      />
      <PreferencesSection settings={settings} />
    </div>
  );
}
