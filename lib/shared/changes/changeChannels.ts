import { organizationChangesTopic, personChangesTopic } from "./topics";
import type { ChangeChannels } from "./types";

/**
 * The channels one person's changes travel on. Published and subscribed to from
 * here, so the token a browser is given and the topic a change is posted to
 * cannot disagree about where it lives.
 */
export function changeChannels({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string | null;
}): ChangeChannels {
  return {
    person: personChangesTopic(userId),
    organization: organizationId ? organizationChangesTopic(organizationId) : null,
  };
}
