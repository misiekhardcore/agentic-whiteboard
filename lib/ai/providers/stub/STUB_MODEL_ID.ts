/**
 * A scripted provider, selected with `AI_PROVIDER=stub`.
 *
 * The e2e suite needs a deterministic model that can also call a tool, so the
 * dashboard flow can be exercised without a GPU or a hosted endpoint. Every
 * plain reply is prefixed so a demo cannot be mistaken for a real model answer,
 * the scripted confirmations below are fixed strings the suite asserts on, and
 * the provider is only reachable when the deployment opts into it. The route
 * also logs the choice on each run, because a thread answered this way looks
 * exactly like one answered by a model.
 *
 * The script is a tiny policy, not a model: it reads the newest prompt, the
 * tools already called, and their results, then chooses the next call. That is
 * enough to walk create → open, and propose → approve → confirm.
 */
export const STUB_MODEL_ID = "stub-model";
