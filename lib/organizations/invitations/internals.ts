import { canManageTeam } from "../membership";
import { getMemberRole } from "../queries";

export /**
 * Invitations, role changes, removals and account switching.
 *
 * Better Auth owns the rows and enforces its own rules; this module adds the
 * ones it cannot see (is the caller an owner or admin of *this* organization,
 * and may that member's role be changed) and turns its errors into sentences.
 * Every function returns the kernel's failure shape or `null` for success, so a
 * capability can hand the result straight to a form.
 *
 * `headers` is passed in rather than read here: the caller has the request, and
 * keeping it explicit is what lets these functions be exercised without one.
 */
async function isManager(userId: string, organizationId: string): Promise<boolean> {
  const role = await getMemberRole(organizationId, userId);
  return Boolean(role && canManageTeam(role));
}
