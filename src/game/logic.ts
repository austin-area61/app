export type Cell = [number, number];
export interface Arrow { id: number; cells: Cell[]; d: Cell; out: boolean; sliding: boolean; s: number; bad: number }
export interface Level { cols: number; rows: number; mask: boolean[]; arrows: Arrow[] }

const TRIES = 16;
const W_RAY = 2.5;
const W_LEN = 1.5;
const D: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SHAPES = ['square', 'diamond', 'circle', 'heart'] as const;
type Shape = (typeof SHAPES)[number];

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inShape(k: Shape, x: number, y: number) {
  if (k === 'circle') return x * x + y * y <= 1;
  if (k === 'diamond') return Math.abs(x) + Math.abs(y) <= 1;
  if (k === 'square') return true;
  const X = x * 1.25, Y = -y * 1.3 + 0.15;
  return Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y <= 0;
}

export const difficulty = (level: number) => (level < 4 ? 'Easy' : level < 10 ? 'Medium' : 'Hard');

/** Deterministic, always-solvable level. Arrows are placed in reverse removal order:
 *  a new arrow's forward ray may not touch any already-placed arrow, so removing
 *  arrows in reverse placement order always works. */
export function buildLevel(level: number): Level {
  const R = rng(level * 7919 + 13);
  const shape = SHAPES[(level - 1) % 4];
  const n = Math.min(8 + Math.floor(level * 1.1), 20);
  const cols = shape === 'heart' ? Math.max(n, 12) : n;
  const rows = cols;
  const mask: boolean[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) mask[r * cols + c] = inShape(shape, ((c + 0.5) / cols) * 2 - 1, ((r + 0.5) / rows) * 2 - 1);

  const maxLen = Math.min(6 + Math.floor(level * 0.8), 14);
  const occ = new Set<number>();
  const arrows: Arrow[] = [];
  const cells: number[] = [];
  mask.forEach((m, i) => m && cells.push(i));
  // Inner cells first: they are removed last, and their rays stay clear while the board is empty.
  // Edge cells come last, pointing outward, so the whole shape can be densely packed.
  const dist = (i: number) => Math.hypot((i % cols) - (cols - 1) / 2, ((i / cols) | 0) - (rows - 1) / 2);
  const key = new Map<number, number>(cells.map((i) => [i, dist(i) + R() * cols * 0.35]));
  cells.sort((a, b) => key.get(a)! - key.get(b)!);
  const inb = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;
  const free = (c: number, r: number) => inb(c, r) && mask[r * cols + c] && !occ.has(r * cols + c);
  const rayOk = (p: Cell[], d: Cell) => {
    const h = p[p.length - 1];
    let c = h[0] + d[0], r = h[1] + d[1];
    while (inb(c, r)) {
      if (occ.has(r * cols + c) || p.some((q) => q[0] === c && q[1] === r)) return false;
      c += d[0]; r += d[1];
    }
    return true;
  };
  const rayScore = (p: Cell[], d: Cell) => {
    const h = p[p.length - 1];
    let c = h[0] + d[0], r = h[1] + d[1], k = 0;
    while (inb(c, r)) { if (mask[r * cols + c]) k++; c += d[0]; r += d[1]; }
    return k;
  };

  const walk = (i: number): Cell[] => {
    const path: Cell[] = [[i % cols, (i / cols) | 0]];
    const seen = new Set<number>([i]);
    const target = Math.max(3, Math.ceil(maxLen * (0.5 + 0.5 * R())));
    while (path.length < target) {
      const [c, r] = path[path.length - 1];
      const o = D.filter((d) => free(c + d[0], r + d[1]) && !seen.has((r + d[1]) * cols + c + d[0]));
      if (!o.length) break;
      let d = o[Math.floor(R() * o.length)];
      if (path.length > 1 && R() < 0.35) {
        const pv = path[path.length - 2];
        const st = o.find((z) => z[0] === c - pv[0] && z[1] === r - pv[1]);
        if (st) d = st;
      }
      path.push([c + d[0], r + d[1]]);
      seen.add((r + d[1]) * cols + c + d[0]);
    }
    return path;
  };

  for (const i of cells) {
    if (occ.has(i)) continue;
    let placed: { cells: Cell[]; d: Cell } | null = null;
    let best = -1;
    // Try many candidate snakes and keep the one whose head points through the most
    // still-empty board: those cells get filled later, so the arrow ends up blocked by them.
    for (let k = 0; k < TRIES; k++) {
      const path = walk(i);
      for (const base of [path, path.slice().reverse()]) {
        for (let len = base.length; len >= Math.min(3, base.length); len--) {
          const p = base.slice(0, len);
          const dirs: Cell[] = len > 1 ? [[p[len - 1][0] - p[len - 2][0], p[len - 1][1] - p[len - 2][1]]] : D;
          for (const d of dirs)
            if (rayOk(p, d)) {
              const sc = rayScore(p, d) * W_RAY + len * W_LEN + R() * 2;
              if (sc > best) { best = sc; placed = { cells: p, d }; }
            }
        }
      }
    }
    if (!placed) {
      // fallback: short arrow so no cell is left empty if possible
      const p: Cell[] = [[i % cols, (i / cols) | 0]];
      for (const d of D) if (rayOk(p, d)) { placed = { cells: p, d }; break; }
    }
    if (placed) {
      placed.cells.forEach(([c, r]) => occ.add(r * cols + c));
      arrows.push({ id: arrows.length, cells: placed.cells, d: placed.d, out: false, sliding: false, s: 0, bad: 0 });
    }
  }
  return { cols, rows, mask, arrows };
}

export function occMap(l: Level, skip?: Arrow) {
  const m = new Set<number>();
  for (const a of l.arrows) if (!a.out && a !== skip) a.cells.forEach(([c, r]) => m.add(r * l.cols + c));
  return m;
}

export function isBlocked(l: Level, a: Arrow) {
  const m = occMap(l, a);
  const h = a.cells[a.cells.length - 1];
  let c = h[0] + a.d[0], r = h[1] + a.d[1];
  while (c >= 0 && r >= 0 && c < l.cols && r < l.rows) {
    if (m.has(r * l.cols + c)) return true;
    c += a.d[0]; r += a.d[1];
  }
  return false;
}

function dseg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
  let t = len ? ((px - x1) * dx + (py - y1) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

export function hitTest(l: Level, x: number, y: number, cs: number): Arrow | null {
  let best: Arrow | null = null, bd = cs * 0.55;
  for (const a of l.arrows) {
    if (a.out) continue;
    for (let i = 0; i < a.cells.length; i++) {
      const p = a.cells[i], q = a.cells[Math.min(i + 1, a.cells.length - 1)];
      const d = dseg(x, y, (p[0] + 0.5) * cs, (p[1] + 0.5) * cs, (q[0] + 0.5) * cs, (q[1] + 0.5) * cs);
      if (d < bd) { bd = d; best = a; }
    }
  }
  return best;
}

type Pt = [number, number];
function clip(p: Pt[], from: number, to: number): Pt[] {
  const out: Pt[] = [];
  let acc = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[i + 1];
    const l = Math.hypot(x2 - x1, y2 - y1), a0 = acc, a1 = acc + l;
    acc = a1;
    if (a1 < from || a0 > to || l === 0) continue;
    const f = (t: number): Pt => [x1 + ((x2 - x1) * t) / l, y1 + ((y2 - y1) * t) / l];
    const s = Math.max(from, a0) - a0, e = Math.min(to, a1) - a0;
    if (!out.length) out.push(f(s));
    out.push(f(e));
  }
  return out;
}

/** Visible polyline + head position for an arrow, including its slide-out offset a.s (px). */
export function arrowShape(a: Arrow, cs: number, cols: number, rows: number) {
  const body: Pt[] = a.cells.map(([c, r]) => [(c + 0.5) * cs, (r + 0.5) * cs] as Pt);
  if (body.length === 1) body.unshift([body[0][0] - a.d[0] * 0.4 * cs, body[0][1] - a.d[1] * 0.4 * cs]);
  let L = 0;
  for (let i = 0; i < body.length - 1; i++) L += Math.hypot(body[i + 1][0] - body[i][0], body[i + 1][1] - body[i][1]);
  const hd = body[body.length - 1], far = cs * (cols + rows) + L + cs * 4;
  const poly = body.concat([[hd[0] + a.d[0] * far, hd[1] + a.d[1] * far] as Pt]);
  const line = clip(poly, a.s, a.s + L);
  return line.length < 2 ? null : { line, head: line[line.length - 1], travel: cs * (cols + rows) + L };
}
