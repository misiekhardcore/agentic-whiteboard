"use client";

import { Alert, AlertDescription } from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Input } from "@konopskidev/ui/components/input";
import { Label } from "@konopskidev/ui/components/label";
import { useActionState } from "react";

import { updatePersonalProfileAction } from "@/lib/identity/actions";
import { EMPTY_PROFILE_FORM_STATE } from "@/lib/identity/forms";

export function PersonalProfileForm({
  user,
}: {
  user: { name: string; email: string; image: string | null };
}) {
  const [state, formAction, pending] = useActionState(
    updatePersonalProfileAction,
    EMPTY_PROFILE_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            name="name"
            defaultValue={user.name}
            autoComplete="name"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={user.email} disabled readOnly />
          <p className="text-xs text-muted-foreground">
            Your email is used to sign in and cannot be changed here.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-image">Profile photo URL</Label>
        <Input
          id="profile-image"
          name="image"
          type="url"
          defaultValue={user.image ?? ""}
          placeholder="https://example.com/photo.jpg"
        />
        <p className="text-xs text-muted-foreground">
          Paste a link to an image. Leave it empty to use your initials.
        </p>
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

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
