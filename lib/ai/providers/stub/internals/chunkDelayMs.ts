export /**
 * The gap between word deltas. A real provider takes hundreds of milliseconds
 * per word on a local model, so the suite sets `AI_STUB_CHUNK_DELAY_MS` to give
 * tests time to observe a reply mid-flight; unset, the script answers at once.
 */
function chunkDelayMs(): number {
  const configured = Number(process.env.AI_STUB_CHUNK_DELAY_MS ?? 0);
  return Number.isFinite(configured) && configured > 0 ? configured : 0;
}
