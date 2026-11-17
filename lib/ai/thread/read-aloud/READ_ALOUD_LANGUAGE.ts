/**
 * Rules for reading an agent reply aloud with the browser's speech synthesis.
 *
 * Replies stream in token-sized pieces, so the synthesizer must never be handed
 * whatever happens to have arrived: speaking a partial word or phrase and then
 * repeating it is worse than waiting. The module therefore turns a reply into
 * whole sentences, and the component only decides when to hand them over. It is
 * pure so the boundary rules are tested directly, and it owns no browser API.
 */
/** Matches the dictation language: the composer's copy is English. */
export const READ_ALOUD_LANGUAGE = "en-US";
