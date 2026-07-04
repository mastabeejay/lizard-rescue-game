export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2D(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// EMA step: moves `current` toward `target` by `alpha` (0..1)
export function emaStep(current, target, alpha) {
  return current + (target - current) * alpha;
}

export function mirrorX(nx) {
  return 1 - nx;
}

export function stdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function circleIntersectsCircle(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= (ar + br) * (ar + br);
}

export function pointInCircle(px, py, cx, cy, r) {
  return dist2D(px, py, cx, cy) <= r;
}

export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function pickWeighted(items, weightFn) {
  const total = items.reduce((sum, it) => sum + weightFn(it), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightFn(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
