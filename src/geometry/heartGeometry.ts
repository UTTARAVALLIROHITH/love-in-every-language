export interface Point2D {
  x: number;
  y: number;
}

export interface ScanlineInterval {
  xStart: number;
  xEnd: number;
}

export interface NormalizedHeartPolygon {
  /** Vertices normalized to fit [-0.5, 0.5] horizontally and [-0.5, 0.5] vertically (preserving aspect ratio) */
  points: Point2D[];
  /** Natural width-to-height ratio of the mathematical heart curve */
  aspectRatio: number;
  /** Normalized Y coordinate of the central top cleft in [-0.5, 0.5] */
  cleftY: number;
}

const RAW_SAMPLES = 1600;

/**
 * Computes raw parametric heart coordinates:
 *   x(t) = 16 sin^3(t)
 *   y(t) = -(13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t))
 * Inverted Y so negative is up (screen coordinates).
 */
function rawHeartPoint(t: number): Point2D {
  const sinT = Math.sin(t);
  const x = 16 * sinT * sinT * sinT;
  const y = -(
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t)
  );
  return { x, y };
}

export const HEART_POLYGON: NormalizedHeartPolygon = (() => {
  const raw: Point2D[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < RAW_SAMPLES; i++) {
    const t = (2 * Math.PI * i) / RAW_SAMPLES;
    const p = rawHeartPoint(t);
    raw.push(p);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;

  const points: Point2D[] = raw.map((p) => ({
    x: (p.x - centerX) / rawW,
    y: (p.y - centerY) / rawH,
  }));

  const cleftRaw = rawHeartPoint(0);
  const cleftY = (cleftRaw.y - centerY) / rawH;

  return {
    points,
    aspectRatio: rawW / rawH,
    cleftY,
  };
})();

/**
 * Scales the normalized heart polygon to pixel/world coordinates centered at (cx, cy)
 * with exact bounding width `width` and height `height = width / aspectRatio`.
 */
export function getScaledHeartPoints(
  cx: number,
  cy: number,
  width: number,
  height: number
): Point2D[] {
  return HEART_POLYGON.points.map((p) => ({
    x: cx + p.x * width,
    y: cy + p.y * height,
  }));
}

/**
 * Exact scanline-polygon intersection solver.
 * Correctly returns 2 separate intervals [left lobe, right lobe] near the top indentation
 * and 1 unified interval below the central cleft.
 */
export function getHeartScanlineIntervals(
  normY: number,
  points: Point2D[] = HEART_POLYGON.points
): ScanlineInterval[] {
  // Perturb slightly if exactly hitting a horizontal vertex to guarantee even intersections
  let y = normY;
  if (Math.abs(y - HEART_POLYGON.cleftY) < 1e-6) {
    y += 1e-5;
  }

  const xs: number[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
      const t = (y - p1.y) / (p2.y - p1.y);
      xs.push(p1.x + t * (p2.x - p1.x));
    }
  }

  if (xs.length < 2) return [];
  xs.sort((a, b) => a - b);

  const intervals: ScanlineInterval[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const xStart = xs[i];
    const xEnd = xs[i + 1];
    if (xEnd - xStart > 1e-5) {
      intervals.push({ xStart, xEnd });
    }
  }
  return intervals;
}

/**
 * Exact ray-casting point-in-polygon check in normalized [-0.5, 0.5] space.
 */
export function isPointInHeart(
  normX: number,
  normY: number,
  points: Point2D[] = HEART_POLYGON.points
): boolean {
  let inside = false;
  const n = points.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect =
      yi > normY !== yj > normY &&
      normX < ((xj - xi) * (normY - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes minimum Euclidean distance from an interior normalized point (normX, normY)
 * to the heart boundary (coarse-sampled for speed, ~320 boundary points).
 * Normalized to [0, 1] where 0 is the exact boundary and 1 is the deepest core.
 */
const COARSE_BOUNDARY: Point2D[] = HEART_POLYGON.points.filter((_, idx) => idx % 5 === 0);

export function getNormalizedHeartDepth(normX: number, normY: number): number {
  if (!isPointInHeart(normX, normY)) return 0;

  let minDistSq = Infinity;
  for (let i = 0; i < COARSE_BOUNDARY.length; i++) {
    const dx = normX - COARSE_BOUNDARY[i].x;
    const dy = normY - COARSE_BOUNDARY[i].y;
    const d2 = dx * dx + dy * dy;
    if (d2 < minDistSq) minDistSq = d2;
  }

  // Maximum inscribed radius in normalized [-0.5, 0.5] heart is ~0.31
  const dist = Math.sqrt(minDistSq);
  return Math.min(1, dist / 0.305);
}