/**
 * The organization slug rule, once.
 *
 * The team form, the profile form and checkout all derive a slug from a name,
 * and the first two let a person edit it. They must agree on what is valid, so
 * the normalization lives here instead of in each action.
 */
export const ORGANIZATION_SLUG_MAX_LENGTH = 40;
