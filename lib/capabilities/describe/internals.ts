import { type ToolPresentation } from "../define";

export /**
 * Widening a capability for the registry, the tool catalog and the thread. The
 * registry is the only consumer, so the casting stays here instead of at every
 * call site that only needs the surface.
 */
function presentation<I>(
  present: ((input: I) => ToolPresentation) | undefined,
): ((input: unknown) => ToolPresentation) | undefined {
  return present ? (input: unknown) => present(input as I) : undefined;
}
