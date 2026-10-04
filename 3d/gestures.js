// Pure pointer transition: one finger and at most one action per gesture.
export function reduceGesture(state, type, pointer) {
  if (type === 'down') {
    if (state || pointer.isPrimary === false) return { state, action: null };
    return { state: { id: pointer.pointerId, x: pointer.clientX, y: pointer.clientY, used: false }, action: null };
  }
  if (!state || state.id !== pointer.pointerId) return { state, action: null };
  if (type === 'cancel') return { state: null, action: null };
  const dx = pointer.clientX - state.x, dy = pointer.clientY - state.y;
  const swiped = Math.max(Math.abs(dx), Math.abs(dy)) >= 28;
  const action = state.used ? null : swiped
    ? Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'slide' : 'jump'
    : type === 'up' ? 'jump' : null;
  return { state: type === 'up' ? null : action ? { ...state, used: true } : state, action };
}
