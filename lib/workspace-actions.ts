"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  getOrganizationEntitlements,
  getUserEntitlements,
} from "@/lib/billing/entitlements";
import { workspaceLimitMessage } from "@/lib/billing/usage";
import { db } from "@/lib/db";
import { member, organization, workspaces } from "@/lib/db/schema";
import {
  EMPTY_WORKSPACE_FORM_STATE,
  WORKSPACE_DESCRIPTION_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
  type WorkspaceFieldErrors,
  type WorkspaceFormState,
} from "@/lib/workspace-form";
import { isWorkspaceStatus } from "@/lib/workspace-status";
import {
  accountWorkspacesWhere,
  getWorkspaceForUser,
  workspacePermission,
} from "@/lib/workspaces";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

async function requireSession(): Promise<Session> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in?redirectTo=/dashboard");
  return session;
}

/**
 * The account the person is acting as. A session pointing at an organization
 * they have since left falls back to the personal account, matching how the
 * dashboard and billing read the active account.
 */
async function activeAccount(
  session: Session,
): Promise<{ organizationId: string | null; name: string }> {
  const organizationId = session.session.activeOrganizationId ?? null;

  if (!organizationId) {
    return { organizationId: null, name: session.user.name };
  }

  const [row] = await db
    .select({ name: organization.name })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!row) return { organizationId: null, name: session.user.name };

  return { organizationId, name: row.name };
}

function validateName(name: string): WorkspaceFieldErrors {
  if (!name) return { name: "Name your workspace." };
  if (name.length > WORKSPACE_NAME_MAX_LENGTH) {
    return {
      name: `Keep the name under ${WORKSPACE_NAME_MAX_LENGTH} characters.`,
    };
  }
  return {};
}

/**
 * Creates a workspace in the active account. The count and the insert share a
 * transaction with an advisory lock on the account, so two requests cannot both
 * take the last slot on a capped plan.
 */
export async function createWorkspaceAction(
  _previousState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const session = await requireSession();

  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();

  const nameErrors = validateName(name);
  if (Object.keys(nameErrors).length > 0) {
    return { ...EMPTY_WORKSPACE_FORM_STATE, fieldErrors: nameErrors };
  }
  if (descriptionRaw.length > WORKSPACE_DESCRIPTION_MAX_LENGTH) {
    return {
      ...EMPTY_WORKSPACE_FORM_STATE,
      fieldErrors: {
        description: `Keep the description under ${WORKSPACE_DESCRIPTION_MAX_LENGTH} characters.`,
      },
    };
  }

  const account = await activeAccount(session);

  const entitlements = account.organizationId
    ? await getOrganizationEntitlements(account.organizationId)
    : await getUserEntitlements(session.user.id);

  const description = descriptionRaw || null;
  const ownerKey =
    account.organizationId ?? `personal:${session.user.id}`;

  const limitError = await db.transaction(async (tx) => {
    // Serialize creates per account so the quota cannot be exceeded by two
    // requests that both counted the same used rows.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('workspace_create'), hashtext(${ownerKey}))`,
    );

    const [row] = await tx
      .select({ total: count() })
      .from(workspaces)
      .where(accountWorkspacesWhere(session.user.id, account.organizationId));

    const message = workspaceLimitMessage({
      used: Number(row?.total ?? 0),
      limit: entitlements.limits.workspaces,
      plan: entitlements.plan.name,
      accountName: account.name,
    });

    if (message) return message;

    await tx.insert(workspaces).values({
      name,
      description,
      creatorId: session.user.id,
      orgId: account.organizationId,
    });

    return null;
  });

  if (limitError) {
    return {
      ...EMPTY_WORKSPACE_FORM_STATE,
      error: limitError,
      limitReached: true,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/workspaces");
  return {
    ...EMPTY_WORKSPACE_FORM_STATE,
    notice: `${name} created.`,
    saved: true,
  };
}

/**
 * Renames a workspace and moves it between stages. Authorization is resolved from
 * the workspace's own account, so a stale active-account id cannot reach another
 * tenant's rows.
 */
export async function updateWorkspaceAction(
  _previousState: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const session = await requireSession();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { ...EMPTY_WORKSPACE_FORM_STATE, error: "That workspace could not be found." };
  }

  const access = await getWorkspaceForUser(id, session.user.id);
  if (!access || workspacePermission(access) !== "edit") {
    return { ...EMPTY_WORKSPACE_FORM_STATE, error: "You cannot edit that workspace." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const status = formData.get("status");

  const nameErrors = validateName(name);
  if (Object.keys(nameErrors).length > 0) {
    return { ...EMPTY_WORKSPACE_FORM_STATE, fieldErrors: nameErrors };
  }
  if (descriptionRaw.length > WORKSPACE_DESCRIPTION_MAX_LENGTH) {
    return {
      ...EMPTY_WORKSPACE_FORM_STATE,
      fieldErrors: {
        description: `Keep the description under ${WORKSPACE_DESCRIPTION_MAX_LENGTH} characters.`,
      },
    };
  }
  if (!isWorkspaceStatus(status)) {
    return {
      ...EMPTY_WORKSPACE_FORM_STATE,
      fieldErrors: { status: "Choose a stage for the workspace." },
    };
  }

  await db
    .update(workspaces)
    .set({
      name,
      description: descriptionRaw || null,
      status,
    })
    .where(eq(workspaces.id, id));

  revalidatePath("/dashboard");
  revalidatePath("/workspaces");
  revalidatePath(`/workspace/${id}`);

  return {
    ...EMPTY_WORKSPACE_FORM_STATE,
    notice: `${name} updated.`,
    saved: true,
  };
}

/** Soft delete: the workspace is hidden and stops counting against the plan. */
export async function archiveWorkspaceAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const access = await getWorkspaceForUser(id, session.user.id);
  if (!access || workspacePermission(access) !== "edit") return;

  await db
    .update(workspaces)
    .set({ archivedAt: new Date() })
    .where(eq(workspaces.id, id));

  revalidatePath("/dashboard");
  revalidatePath("/workspaces");
  revalidatePath(`/workspace/${id}`);
}

/** Puts an archived workspace back on the dashboard and into the plan meter. */
export async function restoreWorkspaceAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const access = await getWorkspaceForUser(id, session.user.id);
  if (!access || workspacePermission(access) !== "edit") return;

  await db
    .update(workspaces)
    .set({ archivedAt: null })
    .where(eq(workspaces.id, id));

  revalidatePath("/dashboard");
  revalidatePath("/workspaces");
  revalidatePath(`/workspace/${id}`);
}
