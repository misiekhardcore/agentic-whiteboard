import { action } from "@/lib/capabilities/action";

import {
  acceptInvitation,
  cancelInvitation,
  createOrganization,
  inviteMember,
  removeMember,
  switchAccount,
  updateMemberRole,
  updateOrganizationProfile,
} from "../capabilities";

export /**
 * Server actions are the human entry point: authenticate, invoke the
 * capability, map the result onto the form's state. Nothing is validated or
 * authorized here, so the dialog and the rule agree by construction.
 */
const create = action(createOrganization);

export const switchTo = action(switchAccount);

export const invite = action(inviteMember);

export const changeRole = action(updateMemberRole);

export const cancel = action(cancelInvitation);

export const remove = action(removeMember);

export const accept = action(acceptInvitation);

export const saveProfile = action(updateOrganizationProfile);
