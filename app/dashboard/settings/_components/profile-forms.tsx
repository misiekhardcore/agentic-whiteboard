"use client";

import {
  Alert,
  AlertDescription,
} from "@konopskidev/ui/components/alert";
import { Button } from "@konopskidev/ui/components/button";
import { Input } from "@konopskidev/ui/components/input";
import { Label } from "@konopskidev/ui/components/label";
import { useActionState } from "react";

import {
  updateOrganizationProfileAction,
  updatePersonalProfileAction,
} from "@/lib/profile-actions";
import { EMPTY_PROFILE_FORM_STATE } from "@/lib/profile-form";

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
          <Input
            id="profile-email"
            value={user.email}
            disabled
            readOnly
          />
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

export function OrganizationProfileForm({
  organization,
  canManage,
}: {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  };
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateOrganizationProfileAction,
    EMPTY_PROFILE_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input
        type="hidden"
        name="organizationId"
        value={organization.id}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="organization-name">Name</Label>
          <Input
            id="organization-name"
            name="name"
            defaultValue={organization.name}
            disabled={!canManage}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="organization-slug">URL</Label>
          <Input
            id="organization-slug"
            name="slug"
            defaultValue={organization.slug}
            disabled={!canManage}
            pattern="[a-zA-Z0-9-]+"
            required
          />
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="organization-logo">Logo URL</Label>
        <Input
          id="organization-logo"
          name="logo"
          type="url"
          defaultValue={organization.logo ?? ""}
          placeholder="https://example.com/logo.png"
          disabled={!canManage}
        />
        <p className="text-xs text-muted-foreground">
          Shown in the account menu. Leave it empty to use the
          organization icon.
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

      {canManage ? (
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save organization"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only owners and admins can edit the organization profile.
        </p>
      )}
    </form>
  );
}
