export function generateId(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
