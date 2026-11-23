/**
 * Dibujos animados (formato Lottie) de la página de seguimiento. Están hechos con código, sin archivos
 * ni licencias de terceros: un dibujo por etapa de la orden y el confeti de "¡Listo para recoger!".
 */
type Obj = Record<string, unknown>;
type Value = number | number[];
type Key = [frame: number, value: Value];
type Ease = { o: { x: number; y: number }; i: { x: number; y: number } };
interface LayerProps { o?: Obj; r?: Obj; p?: Obj; a?: Obj; s?: Obj }
interface ShapeTransform { p?: Obj; a?: Obj; s?: Obj; r?: Obj; o?: Obj }

const WHITE = "#ffffff";
const MINT = "#5eead4";
const AMBER = "#f59e0b";
const SLATE = "#94a3b8";
const SMOOTH: Ease = { o: { x: 0.4, y: 0 }, i: { x: 0.2, y: 1 } };
const LINEAR: Ease = { o: { x: 0.5, y: 0.5 }, i: { x: 0.5, y: 0.5 } };

const rgba = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};
const fixed = (k: unknown): Obj => ({ a: 0, k });
const moving = (keys: Key[], ease: Ease = SMOOTH): Obj => ({
  a: 1,
  k: keys.map(([t, v], n) => {
    const s = Array.isArray(v) ? v : [v];
    return n < keys.length - 1 ? { t, s, ...ease } : { t, s };
  }),
});
const group = (items: Obj[], t: ShapeTransform = {}): Obj => ({
  ty: "gr",
  it: [...items, { ty: "tr", p: t.p || fixed([0, 0]), a: t.a || fixed([0, 0]), s: t.s || fixed([100, 100]), r: t.r || fixed(0), o: t.o || fixed(100), sk: fixed(0), sa: fixed(0) }],
});
const fill = (hex: string, opacity = 100): Obj => ({ ty: "fl", c: fixed(rgba(hex)), o: fixed(opacity), r: 1 });
const stroke = (hex: string, w: number): Obj => ({ ty: "st", c: fixed(rgba(hex)), o: fixed(100), w: fixed(w), lc: 2, lj: 2, ml: 4 });
const rect = (w: number, h: number, x: number, y: number, r = 0): Obj => ({ ty: "rc", d: 1, s: fixed([w, h]), p: fixed([x, y]), r: fixed(r) });
const ellipse = (w: number, h: number, x: number, y: number): Obj => ({ ty: "el", d: 1, s: fixed([w, h]), p: fixed([x, y]) });
const path = (v: number[][], closed = false): Obj => ({ ty: "sh", ks: fixed({ v, i: v.map(() => [0, 0]), o: v.map(() => [0, 0]), c: closed }) });
const draw = (end: Obj): Obj => ({ ty: "tm", s: fixed(0), e: end, o: fixed(0), m: 1 });
const layer = (ind: number, shapes: Obj[], k: LayerProps, op: number): Obj => ({
  ddd: 0, ind, ty: 4, nm: `capa${ind}`, sr: 1,
  ks: { o: k.o || fixed(100), r: k.r || fixed(0), p: k.p || fixed([60, 60, 0]), a: k.a || fixed([60, 60, 0]), s: k.s || fixed([100, 100, 100]) },
  ao: 0, shapes, ip: 0, op, st: 0, bm: 0,
});
const scene = (layers: Obj[], op: number, w = 120, h = 120): Obj => ({ v: "5.7.4", fr: 30, ip: 0, op, w, h, nm: "seguimiento", ddd: 0, assets: [], layers });

function gear(ind: number, cx: number, cy: number, radius: number, teeth: number, color: string, turn: number, op: number) {
  const size = radius * 0.46;
  const parts = [group([ellipse(radius * 2, radius * 2, cx, cy), stroke(color, radius * 0.44)])];
  for (let n = 0; n < teeth; n++) {
    parts.push(group([rect(size, size, cx, cy - radius - size * 0.55, 2), fill(color)], { a: fixed([cx, cy]), p: fixed([cx, cy]), r: fixed((n * 360) / teeth) }));
  }
  return layer(ind, parts, { a: fixed([cx, cy, 0]), p: fixed([cx, cy, 0]), r: moving([[0, 0], [op, turn]], LINEAR) }, op);
}

const hourglass = () => scene([layer(1, [
  group([rect(46, 6, 60, 27, 3), fill(WHITE)]),
  group([rect(46, 6, 60, 93, 3), fill(WHITE)]),
  group([path([[45, 31], [75, 31], [75, 41], [64, 60], [75, 79], [75, 89], [45, 89], [45, 79], [56, 60], [45, 41]], true), stroke(WHITE, 4)]),
  group([rect(3, 24, 60, 71, 1), fill(AMBER)], { o: moving([[0, 100], [56, 100], [60, 0], [90, 0]]) }),
  group([path([[49, 40], [71, 40], [60, 58]], true), fill(AMBER)], { a: fixed([60, 58]), p: fixed([60, 58]), s: moving([[0, [100, 100]], [58, [0, 0]], [90, [0, 0]]], LINEAR) }),
  group([path([[49, 84], [71, 84], [60, 66]], true), fill(AMBER)], { a: fixed([60, 84]), p: fixed([60, 84]), s: moving([[0, [0, 0]], [58, [100, 100]], [90, [100, 100]]], LINEAR) }),
], { r: moving([[0, 0], [62, 0], [82, 180], [90, 180]]) }, 90)], 90);

const magnifier = () => scene([
  layer(1, [group([ellipse(10, 10, 86, 32), fill(MINT)])], { a: fixed([86, 32, 0]), p: fixed([86, 32, 0]), s: moving([[0, [0, 0, 100]], [54, [0, 0, 100]], [62, [130, 130, 100]], [72, [0, 0, 100]], [120, [0, 0, 100]]]) }, 120),
  layer(2, [
    group([path([[66, 66], [84, 84]]), stroke(WHITE, 8)]),
    group([ellipse(36, 36, 53, 53), fill(WHITE, 16)]),
    group([ellipse(36, 36, 53, 53), stroke(WHITE, 6)]),
  ], { p: moving([[0, [66, 66, 0]], [30, [54, 54, 0]], [60, [72, 48, 0]], [90, [56, 70, 0]], [120, [66, 66, 0]]]) }, 120),
  layer(3, [
    group([rect(26, 3, 60, 48, 1.5), fill(SLATE)]),
    group([rect(26, 3, 60, 60, 1.5), fill(SLATE)]),
    group([rect(18, 3, 56, 72, 1.5), fill(SLATE)]),
    group([rect(46, 66, 60, 60, 8), stroke(SLATE, 3)]),
  ], {}, 120),
], 120);

const parcel = () => scene([
  layer(1, [
    group([rect(10, 14, 60, 46), fill("#fde68a")]),
    group([rect(62, 13, 60, 46, 3), fill("#f59e0b")]),
    group([rect(10, 45, 60, 70), fill("#fde68a")]),
    group([rect(54, 45, 60, 70, 4), fill(AMBER)]),
  ], {
    a: fixed([60, 92, 0]),
    p: moving([[0, [60, 92, 0]], [52, [60, 92, 0]], [64, [60, 70, 0]], [76, [60, 92, 0]], [100, [60, 92, 0]]]),
    s: moving([[0, [100, 100, 100]], [44, [100, 100, 100]], [52, [108, 90, 100]], [62, [95, 107, 100]], [76, [112, 86, 100]], [86, [97, 104, 100]], [100, [100, 100, 100]]]),
  }, 100),
  layer(2, [group([ellipse(60, 7, 60, 96), fill("#000000", 28)])], { a: fixed([60, 96, 0]), p: fixed([60, 96, 0]), s: moving([[0, [100, 100, 100]], [52, [100, 100, 100]], [64, [60, 60, 100]], [76, [108, 108, 100]], [100, [100, 100, 100]]]) }, 100),
], 100);

const gears = () => scene([gear(1, 49, 51, 20, 8, WHITE, 360, 90), gear(2, 84, 85, 12, 6, MINT, -480, 90)], 90);

const readyCheck = () => scene([
  layer(1, [group([path([[43, 61], [55, 73], [78, 48]]), draw(moving([[12, 0], [28, 100]])), stroke("#047857", 9)])], {}, 70),
  layer(2, [group([ellipse(66, 66, 60, 60), fill(WHITE)])], { s: moving([[0, [0, 0, 100]], [12, [114, 114, 100]], [20, [100, 100, 100]], [70, [100, 100, 100]]]) }, 70),
  layer(3, [group([ellipse(66, 66, 60, 60), stroke(MINT, 4)])], { s: moving([[8, [70, 70, 100]], [36, [160, 160, 100]]]), o: moving([[8, 90], [36, 0]]) }, 70),
], 70);

const handedOver = () => scene([
  layer(1, [
    group([path([[75, 84], [82, 91], [93, 78]]), draw(moving([[32, 0], [44, 100]])), stroke(WHITE, 5)]),
    group([ellipse(32, 32, 84, 84), fill("#10b981")]),
  ], { a: fixed([84, 84, 0]), p: fixed([84, 84, 0]), s: moving([[0, [0, 0, 100]], [24, [0, 0, 100]], [34, [118, 118, 100]], [42, [100, 100, 100]], [70, [100, 100, 100]]]) }, 70),
  layer(2, [
    group([rect(12, 3, 54, 29, 1.5), fill(SLATE)]),
    group([rect(36, 52, 54, 60, 3), fill("#475569")]),
    group([rect(44, 76, 54, 60, 10), fill(WHITE)]),
  ], { p: moving([[0, [18, 60, 0]], [18, [64, 60, 0]], [26, [60, 60, 0]], [70, [60, 60, 0]]]), o: moving([[0, 0], [8, 100]]) }, 70),
], 70);

/** Un dibujo por etapa. Los dos últimos se dibujan una vez y quedan quietos; los demás se repiten. */
export const TRACK_ICONS: Record<string, () => Obj> = {
  pending: hourglass,
  diagnosed: magnifier,
  waiting_parts: parcel,
  in_progress: gears,
  completed: readyCheck,
  delivered: handedOver,
};
export const TRACK_ICON_ONCE = new Set(["completed", "delivered"]);

export function trackConfetti(): Obj {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const colors = [MINT, AMBER, WHITE, "#93c5fd", "#fecaca"];
  const pieces: Obj[] = [];
  for (let n = 0; n < 46; n++) {
    const delay = Math.round(rnd() * 22);
    const x = 40 + rnd() * 720;
    const end = x + (rnd() - 0.5) * 110;
    const w = 6 + rnd() * 5;
    const turn = (rnd() > 0.5 ? 1 : -1) * (240 + rnd() * 420);
    pieces.push(layer(n + 1, [group([rect(w, w * 1.5, 0, 0, 1.5), fill(colors[n % colors.length])])], {
      a: fixed([0, 0, 0]),
      p: moving([[delay, [x, -14, 0]], [delay + 58, [end, 262, 0]]], { o: { x: 0.3, y: 0.2 }, i: { x: 0.7, y: 1 } }),
      r: moving([[delay, 0], [delay + 58, turn]], LINEAR),
      o: moving([[delay + 38, 100], [delay + 58, 0]], LINEAR),
    }, 90));
  }
  return scene(pieces, 90, 800, 240);
}
