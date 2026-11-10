"use client";

import { ThemeSwitcher } from "@konopskidev/ui/components/theme-switcher";
import { useSyncExternalStore } from "react";

/*
 * `useSyncExternalStore` with a never-changing snapshot is the hook-shaped way
 * to ask "is this the client?": the server sees `false`, and the browser
 * re-renders once with `true` after hydration, without a state update in an
 * effect.
 */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `ThemeSwitcher` reads the stored choice from next-themes, which only knows it
 * on the client. The server therefore always marks "System", and React keeps
 * that stale `aria-checked` through hydration, so a reload with Light or Dark
 * stored showed the wrong segment as selected until the next pick.
 *
 * Rendering the switcher only once hydrated sidesteps that mismatch. The
 * placeholder is exactly the switcher's size (three `size="sm"` options make
 * 96x32), so the header does not shift when the real control appears.
 */
export function HeaderThemeSwitcher() {
  const hydrated = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (!hydrated) {
    return <div aria-hidden className="h-8 w-24" />;
  }

  return <ThemeSwitcher size="sm" />;
}
