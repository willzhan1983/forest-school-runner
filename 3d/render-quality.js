const MAX_RENDER_PIXELS = 2_000_000;

export function renderPixelRatio(width, height, deviceRatio, reduced = false) {
  const cap = height > width ? 1.2 : 1.6;
  const ratio = Math.min(deviceRatio || 1, cap, Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, width * height)));
  return ratio * (reduced ? 0.75 : 1);
}

export function sampleRenderQuality(state, now, eligible) {
  if (state.reduced) return state;
  if (!eligible) return { lastTime: null, slowMs: 0, reduced: false };
  const elapsed = state.lastTime === null ? 0 : now - state.lastTime;
  // Ignore isolated stalls (tab switching, shader compilation), not sustained low frame rates.
  const slowMs = elapsed >= 25 && elapsed <= 250 ? state.slowMs + elapsed : 0;
  return { lastTime: now, slowMs, reduced: slowMs >= 2000 };
}
