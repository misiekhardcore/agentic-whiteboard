import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@konopskidev/ui/components/card";

import type { PersonalSettings } from "@/lib/identity/settings";

import { PreferencesForm } from "./preferences-form";

/** Preferences follow the person, not the active account. */
export function PreferencesSection({ settings }: { settings: PersonalSettings }) {
  return (
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
  );
}
