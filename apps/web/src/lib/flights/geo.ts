/** Great-circle helpers for animated flight routes. */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function toCartesian(lng: number, lat: number): [number, number, number] {
  const λ = lng * DEG;
  const φ = lat * DEG;
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
}

function fromCartesian(x: number, y: number, z: number): [number, number] {
  return [Math.atan2(y, x) * RAD, Math.atan2(z, Math.hypot(x, y)) * RAD];
}

function interpolateArc(
  a: [number, number],
  b: [number, number],
  steps: number,
): [number, number][] {
  const [x1, y1, z1] = toCartesian(a[0], a[1]);
  const [x2, y2, z2] = toCartesian(b[0], b[1]);
  const dot = Math.min(1, Math.max(-1, x1 * x2 + y1 * y2 + z1 * z2));
  const omega = Math.acos(dot);

  if (!Number.isFinite(omega) || omega < 1e-6) {
    return [a, b];
  }

  const pts: [number, number][] = [];
  const sinOmega = Math.sin(omega);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s1 = Math.sin((1 - t) * omega) / sinOmega;
    const s2 = Math.sin(t * omega) / sinOmega;
    pts.push(fromCartesian(x1 * s1 + x2 * s2, y1 * s1 + y2 * s2, z1 * s1 + z2 * s2));
  }
  return pts;
}

/** Build a dense polyline across ordered airport points (great-circle segments). */
export function buildRouteLine(
  points: [number, number][],
  stepsPerSegment = 64,
): [number, number][] {
  if (points.length < 2) return points.slice();
  const line: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const segment = interpolateArc(points[i], points[i + 1], stepsPerSegment);
    if (i > 0) segment.shift();
    line.push(...segment);
  }
  return line;
}

export function pointAlongLine(
  line: [number, number][],
  t: number,
): { lngLat: [number, number]; bearing: number } {
  if (line.length === 0) return { lngLat: [0, 0], bearing: 0 };
  if (line.length === 1) return { lngLat: line[0], bearing: 0 };

  const clamped = Math.min(1, Math.max(0, t));
  const idx = clamped * (line.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const a = line[i];
  const b = line[Math.min(i + 1, line.length - 1)];
  const lngLat: [number, number] = [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
  ];
  const bearing = Math.atan2(b[0] - a[0], b[1] - a[1]) * RAD;
  return { lngLat, bearing };
}
