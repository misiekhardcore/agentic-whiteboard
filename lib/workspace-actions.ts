"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSessionAccount } from "@/lib/account";
import { routes, signInPath } from "@/lib/routes";
import {
  EMPTY_WORKSPACE_FORM_STATE,
  type WorkspaceFormState,
} from "@/lib/workspace-form";
import {
  archiveWorkspaceFor,
  createWorkspaceFor,
  restoreWorkspaceFor,
  updateWorkspaceFor,
  type WorkspaceActor,
  type WorkspaceMutationResult,
} from "@/lib/workspace-service";

/**
 * Server actions are thin adapters: authenticate, read the form, delegate to the
 * workspace catalog and revalidate. The rules — permission, quota, validation —
 * live in `lib/workspace-service` so the agent's tools enforce exactly the same
 * ones.
 */

async function requireWorkspaceActor(): Promise<WorkspaceActor> {
  const account = await getSessionAccount();
  if (!account) redirect(signInPath(routes.dashboard));

  return {
    userId: account.session.user.id,
    organizationId: account.activeOrganizationId,
    accountName: account.activeTeam?.name ?? account.session.user.name,
  };
}

function formValue(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "");
}

function revalidateWorkspace(workspaceId: string): void {
  revalidatePath(routes.dashboard);
  revalidatePath(routes.workspaces);
  revalidatePath(routes.workspace(workspaceId));
}

function formState(result: WorkspaceMutationResult, notice: string) {
  if (!result.ok) {
    const fieldErrors = result.fieldErrors ?? {};

    return {
      ...EMPTY_WORKSPACE_FORM_STATE,
      // The field messages already say what to fix; a summary alert would repeat
      // them. Quota and permission refusals have no field, so they keep theirs.
      error: Object.keys(fieldErrors).length > 0 ? null : result.error,
      fieldErrors,
      limitReached: result.limitReached ?? false,
    };
  }

  return { ...EMPTY_WORKSPACE_FORM_STATE, notice, saved: true };
}

export async function createWorkspaceAction(
  _previousState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const actor = await requireWorkspaceActor();

  const result = await createWorkspaceFor(actor, {
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
  });

  if (result.ok) {
    revalidatePath(routes.dashboard);
    revalidatePath(routes.workspaces);
  }

  return formState(result, `${result.ok ? result.workspace.name : ""} created.`);
}

export async function updateWorkspaceAction(
  _previousState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const actor = await requireWorkspaceActor();

  const result = await updateWorkspaceFor(actor, {
    id: formValue(formData, "id"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    status: formValue(formData, "status"),
  });

  if (result.ok) revalidateWorkspace(result.workspace.id);

  return formState(result, `${result.ok ? result.workspace.name : ""} updated.`);
}

export async function archiveWorkspaceAction(formData: FormData): Promise<void> {
  const actor = await requireWorkspaceActor();
  const id = formValue(formData, "id");

  const result = await archiveWorkspaceFor(actor, id);
  if (result.ok) revalidateWorkspace(result.workspace.id);
}

export async function restoreWorkspaceAction(formData: FormData): Promise<void> {
  const actor = await requireWorkspaceActor();
  const id = formValue(formData, "id");

  const result = await restoreWorkspaceFor(actor, id);
  if (result.ok) revalidateWorkspace(result.workspace.id);
}
