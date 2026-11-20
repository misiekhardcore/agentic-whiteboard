export /**
 * A form submission carries its fields as `FormData`; a typed caller passes its
 * object as-is and Zod is the one place that decides what is valid. Action
 * bookkeeping fields (`$ACTION_*`) are not input.
 */
function readInput(raw: unknown): unknown {
  if (typeof FormData === "undefined" || !(raw instanceof FormData)) return raw;

  return Object.fromEntries([...raw.entries()].filter(([key]) => !key.startsWith("$ACTION_")));
}
