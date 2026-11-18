import { action } from "@/lib/capabilities/action";

import { setReadAloud, setReadAloudVoice, updatePersonalProfile } from "../capabilities";

export /**
 * The pre-auth entry points, and the personal profile.
 *
 * Sign-in cannot be a capability: a capability is invoked with an authenticated
 * actor, and there is nobody to authorize before the session exists. These stay
 * thin actions over `authentication.ts`, which owns the policy they share.
 */
const saveProfile = action(updatePersonalProfile);

export const saveReadAloud = action(setReadAloud);

export const saveReadAloudVoicePreference = action(setReadAloudVoice);
