/**
 * 3D cargo packing for the load simulation (all sizes in metres).
 *
 * Boxes keep their real dimensions and may be turned 90 degrees on the floor (never tipped over).
 * Heavier cartons are placed first, and every box goes to the lowest free position first (z), then closest to
 * the cab wall (x), then across the width (y). That makes the floor fill completely before anything is stacked, and builds
 * the load as walls from the cab backwards. A box on top of others needs most of its footprint
 * supported, so nothing hangs in the air.
 *
 * Coordinates: x runs along the length (0 = cab wall), y across the width, z up. Positions are the
 * min corner of a box.
 */

export type PackBox = {
  id: string;
  productKey: string;
  color: string;
  l: number; // length (along the truck)
  w: number; // width (across the truck)
  h: number; // height
  weight?: number;
};

export type PlacedBox = PackBox & { x: number; y: number; z: number };

export type PackBin = { length: number; width: number; height: number };

export type PackResult = {
  placed: PlacedBox[];
  unplaced: PackBox[];
  usedVolume: number;
  binVolume: number;
  volumePct: number;
  floorPct: number;
  /** Highest point of the load. */
  loadHeight: number;
  /** Depth of the load measured from the cab wall. */
  loadLength: number;
};

const EPS = 1e-6;
const MIN_SUPPORT = 0.75;

/** `dead` remembers box sizes that can never fit here (blocked or out of bounds), so they are not re-checked. */
type Point = { x: number; y: number; z: number; dead?: Set<string> };
type Strategy = { sort: (a: PackBox, b: PackBox) => number; preferShortSide: boolean };

const area = (b: PackBox) => b.l * b.w;

// Heaviest first, so heavy cartons take the floor and lighter ones end up above them. Ties: larger footprint, then taller.
const BY_WEIGHT: Strategy["sort"] = (a, b) => (b.weight ?? 0) - (a.weight ?? 0) || area(b) - area(a) || b.h - a.h;
// Fallbacks that ignore weight, used only when the weight-first order cannot fit everything.
const BY_FOOTPRINT: Strategy["sort"] = (a, b) => area(b) - area(a) || (b.weight ?? 0) - (a.weight ?? 0) || b.h - a.h;
const BY_HEIGHT: Strategy["sort"] = (a, b) => b.h - a.h || area(b) - area(a) || (b.weight ?? 0) - (a.weight ?? 0);

const PREFERRED: Strategy[] = [
  { sort: BY_WEIGHT, preferShortSide: true },
  { sort: BY_WEIGHT, preferShortSide: false },
];
const FALLBACK: Strategy[] = [
  { sort: BY_FOOTPRINT, preferShortSide: true },
  { sort: BY_FOOTPRINT, preferShortSide: false },
  { sort: BY_HEIGHT, preferShortSide: true },
  { sort: BY_HEIGHT, preferShortSide: false },
];

function collides(x: number, y: number, z: number, dx: number, dy: number, dz: number, placed: PlacedBox[]) {
  for (let i = 0; i < placed.length; i += 1) {
    const b = placed[i];
    if (x < b.x + b.l - EPS && x + dx > b.x + EPS && y < b.y + b.w - EPS && y + dy > b.y + EPS && z < b.z + b.h - EPS && z + dz > b.z + EPS) return true;
  }
  return false;
}

function supportRatio(x: number, y: number, z: number, dx: number, dy: number, placed: PlacedBox[]) {
  if (z < EPS) return 1;

  let supported = 0;
  for (const b of placed) {
    if (Math.abs(b.z + b.h - z) > EPS) continue;
    const ox = Math.min(x + dx, b.x + b.l) - Math.max(x, b.x);
    const oy = Math.min(y + dy, b.y + b.w) - Math.max(y, b.y);
    if (ox > EPS && oy > EPS) supported += ox * oy;
  }
  return supported / (dx * dy);
}

function runStrategy(boxes: PackBox[], bin: PackBin, strategy: Strategy) {
  const sorted = [...boxes].sort(strategy.sort);
  const placed: PlacedBox[] = [];
  const unplaced: PackBox[] = [];
  let points: Point[] = [{ x: 0, y: 0, z: 0 }];

  for (const box of sorted) {
    const orientations: [number, number][] = [[box.l, box.w]];
    if (Math.abs(box.l - box.w) > EPS) orientations.push([box.w, box.l]);
    if (strategy.preferShortSide) orientations.sort((a, b) => a[0] - b[0]);

    let found: { point: Point; dx: number; dy: number } | null = null;

    for (const point of points) {
      for (const [dx, dy] of orientations) {
        const key = `${dx}|${dy}|${box.h}`;
        if (point.dead?.has(key)) continue;

        if (point.x + dx > bin.length + EPS || point.y + dy > bin.width + EPS || point.z + box.h > bin.height + EPS || collides(point.x, point.y, point.z, dx, dy, box.h, placed)) {
          // free space only shrinks, so this size will never fit here
          (point.dead ??= new Set()).add(key);
          continue;
        }
        if (supportRatio(point.x, point.y, point.z, dx, dy, placed) < MIN_SUPPORT) continue; // may still become supported later
        found = { point, dx, dy };
        break;
      }
      if (found) break;
    }

    if (!found) {
      unplaced.push(box);
      continue;
    }

    const { point, dx, dy } = found;
    placed.push({ ...box, l: dx, w: dy, x: point.x, y: point.y, z: point.z });

    // Points swallowed by the new box are gone; the box adds three new ones (along, across, on top).
    const next = points.filter(
      (p) => !(p.x >= point.x - EPS && p.x < point.x + dx - EPS && p.y >= point.y - EPS && p.y < point.y + dy - EPS && p.z >= point.z - EPS && p.z < point.z + box.h - EPS),
    );
    const candidates: Point[] = [
      { x: point.x + dx, y: point.y, z: point.z },
      { x: point.x, y: point.y + dy, z: point.z },
      { x: point.x, y: point.y, z: point.z + box.h },
    ];
    for (const c of candidates) {
      if (c.x >= bin.length - EPS || c.y >= bin.width - EPS || c.z >= bin.height - EPS) continue;
      if (next.some((p) => Math.abs(p.x - c.x) < EPS && Math.abs(p.y - c.y) < EPS && Math.abs(p.z - c.z) < EPS)) continue;
      next.push(c);
    }
    next.sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y);
    points = next;
  }

  return { placed, unplaced };
}

function measure(placed: PlacedBox[], unplaced: PackBox[], bin: PackBin): PackResult {
  const binVolume = bin.length * bin.width * bin.height;
  let usedVolume = 0;
  let floorArea = 0;
  let loadHeight = 0;
  let loadLength = 0;

  for (const b of placed) {
    usedVolume += b.l * b.w * b.h;
    if (b.z < EPS) floorArea += b.l * b.w;
    loadHeight = Math.max(loadHeight, b.z + b.h);
    loadLength = Math.max(loadLength, b.x + b.l);
  }

  return {
    placed,
    unplaced,
    usedVolume,
    binVolume,
    volumePct: binVolume > 0 ? Math.min((usedVolume / binVolume) * 100, 100) : 0,
    floorPct: bin.length * bin.width > 0 ? Math.min((floorArea / (bin.length * bin.width)) * 100, 100) : 0,
    loadHeight,
    loadLength,
  };
}

const validSize = (n: number) => Number.isFinite(n) && n > 0;

/** Packs the boxes; several ordering strategies are tried and the one that loads the most (then shortest) wins. */
export function packCargo(input: PackBox[], rawBin: PackBin): PackResult {
  // Boxes without a usable size can never be placed; keep them out of the maths so no NaN reaches the 3D scene.
  const bin: PackBin = {
    length: validSize(rawBin.length) ? rawBin.length : 0.1,
    width: validSize(rawBin.width) ? rawBin.width : 0.1,
    height: validSize(rawBin.height) ? rawBin.height : 0.1,
  };
  const boxes = input.filter((b) => validSize(b.l) && validSize(b.w) && validSize(b.h));
  const invalid = input.filter((b) => !(validSize(b.l) && validSize(b.w) && validSize(b.h)));
  if (boxes.length === 0) return measure([], invalid, bin);

  const winner: { best: PackResult | null } = { best: null };
  const consider = (strategies: Strategy[]) => {
    for (const strategy of strategies) {
      const { placed, unplaced } = runStrategy(boxes, bin, strategy);
      const result = measure(placed, unplaced, bin);
      const current = winner.best;
      if (
        !current ||
        result.unplaced.length < current.unplaced.length ||
        (result.unplaced.length === current.unplaced.length && result.loadLength < current.loadLength - EPS)
      ) {
        winner.best = result;
      }
      if (result.unplaced.length === 0 && boxes.length > 400) return; // big loads: first complete layout is good enough
    }
  };

  consider(PREFERRED);
  // Only when the heavy-first order leaves cartons behind do the weight-blind orders get a chance to fit more.
  if (winner.best && winner.best.unplaced.length > 0) consider(FALLBACK);

  const result = winner.best as PackResult;
  return invalid.length > 0 ? { ...result, unplaced: [...result.unplaced, ...invalid] } : result;
}

/** Usable cargo space inside a truck body: the outer bed size minus wall thickness and a hair of clearance. */
export function cargoBinFor(bed: { length: number; width: number; height: number }): PackBin {
  const WALL = 0.07;
  return {
    length: Math.max(bed.length - WALL * 2, 0.1),
    width: Math.max(bed.width - WALL * 2, 0.1),
    height: Math.max(bed.height - 0.1, 0.1),
  };
}
