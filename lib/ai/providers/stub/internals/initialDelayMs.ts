export /**
 * How long the scripted provider holds its first chunk back. It answers
 * instantly, which leaves no window to exercise what a person sees while a
 * reply streams; the e2e server widens that window with `AI_STUB_DELAY_MS`.
 */
function initialDelayMs(): number {
  const configured = Number(process.env.AI_STUB_DELAY_MS ?? 0);
  return Number.isFinite(configured) && configured > 0 ? configured : 0;
}
