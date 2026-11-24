// 電車路線圖：自己畫的示意圖（不照實際比例），選一段行程就拉近、標出要搭的線、方向和站數

import { h } from './dom';

export interface Station {
  name: string; // 日文站名（跟車站看板一樣）
  zh?: string; // 中文說法，跟站名不同時才填
  code?: string; // 車站編號，例如 M19
  x: number;
  y: number;
  label: 'l' | 'r' | 't' | 'b'; // 站名寫在點的哪一邊
}
export interface Line {
  name: string;
  kind: string;
  color: string;
  stations: string[]; // 依行駛順序
  dirs: { up: string; down: string }; // up＝往清單後面走時月台看板寫的方向
  endLabels?: { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' }[]; // 圖上沒畫到的延伸方向（位置手動指定，避免壓到站名）
  partial?: boolean; // 只畫主要站，站數不準
}
export interface Poi {
  name: string;
  icon: string;
  x: number;
  y: number;
}
export interface Network {
  name: string;
  stations: Record<string, Station>;
  lines: Record<string, Line>;
  pois: Poi[];
  areas: { name: string; x: number; y: number; w: number; h: number; nameAt?: 'top' | 'bottom' }[];
}
export type Seg = { line: string; from: string; to: string; info?: string; tip?: string } | { walk: string };
export interface Leg {
  title: string;
  segs: Seg[];
}
export interface RailData {
  network: Network;
  legs: Record<string, Leg>;
}

export const FULL_VIEW = { x: 0, y: 0, w: 1000, h: 1080 };
type Box = typeof FULL_VIEW;

/** 一段搭乘：經過哪些站、往哪個方向、坐幾站 */
export function ride(net: Network, lineId: string, from: string, to: string): { path: string[]; dir: string; stops: number | null } {
  const line = net.lines[lineId];
  if (!line) throw new Error(`沒有這條線：${lineId}`);
  const a = line.stations.indexOf(from);
  const b = line.stations.indexOf(to);
  if (a < 0 || b < 0) throw new Error(`${line.name} 沒有這個站`);
  const path = a <= b ? line.stations.slice(a, b + 1) : line.stations.slice(b, a + 1).reverse();
  return { path, dir: a <= b ? line.dirs.up : line.dirs.down, stops: line.partial ? null : Math.abs(b - a) };
}

/** 一段行程要拉近的範圍（含四周留白，最小 260 寬，比例跟總圖一樣） */
export function legBox(net: Network, leg: Leg): Box {
  const pts = leg.segs.flatMap((s) => ('line' in s ? ride(net, s.line, s.from, s.to).path : [])).map((id) => net.stations[id]);
  if (!pts.length) return FULL_VIEW;
  const pad = 90;
  // 左右多留一點，站名才不會被切掉
  let x0 = Math.min(...pts.map((p) => p.x)) - pad - 50;
  let x1 = Math.max(...pts.map((p) => p.x)) + pad + 50;
  let y0 = Math.min(...pts.map((p) => p.y)) - pad;
  let y1 = Math.max(...pts.map((p) => p.y)) + pad;
  const ratio = FULL_VIEW.w / FULL_VIEW.h;
  let w = Math.max(x1 - x0, 260);
  let hh = Math.max(y1 - y0, 260 / ratio);
  // 補成跟總圖一樣的比例，畫面才不會變形或留白太多
  if (w / hh > ratio) hh = w / ratio;
  else w = hh * ratio;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  x0 = cx - w / 2;
  y0 = cy - hh / 2;
  return { x: Math.round(x0), y: Math.round(y0), w: Math.round(w), h: Math.round(hh) };
}

/* ---------- 畫圖 ---------- */

const NS = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...kids: (Node | string | null)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of kids) if (c != null) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

function labelPos(st: Station): { x: number; y: number; anchor: string } {
  const d = 13;
  if (st.label === 'l') return { x: st.x - d, y: st.y + 5, anchor: 'end' };
  if (st.label === 't') return { x: st.x, y: st.y - d, anchor: 'middle' };
  if (st.label === 'b') return { x: st.x, y: st.y + d + 10, anchor: 'middle' };
  return { x: st.x + d, y: st.y + 5, anchor: 'start' };
}

const pts = (net: Network, ids: string[]) => ids.map((id) => `${net.stations[id].x},${net.stations[id].y}`).join(' ');

function mapSvg(net: Network, leg: Leg | null): SVGSVGElement {
  const used = new Set<string>(); // 這段行程經過的站
  const ends = new Set<string>(); // 上車、下車站
  const rides: { line: Line; path: string[] }[] = [];
  if (leg) {
    for (const sg of leg.segs) {
      if (!('line' in sg)) continue;
      const r = ride(net, sg.line, sg.from, sg.to);
      r.path.forEach((id) => used.add(id));
      ends.add(sg.from).add(sg.to);
      rides.push({ line: net.lines[sg.line], path: r.path });
    }
  }
  const box = leg ? legBox(net, leg) : FULL_VIEW;
  const svg = s('svg', { viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`, class: 'rail-svg', role: 'img', 'aria-label': leg ? `路線圖：${leg.title}` : '關西電車示意圖' });

  for (const a of net.areas) svg.append(s('rect', { x: a.x, y: a.y, width: a.w, height: a.h, rx: 24, class: 'rail-area' }), a.nameAt === 'bottom' ? s('text', { x: a.x + a.w - 14, y: a.y + a.h - 12, class: 'rail-area-name', 'text-anchor': 'end' }, a.name) : s('text', { x: a.x + 14, y: a.y + 26, class: 'rail-area-name' }, a.name));

  // 全部路線（有選行程時變淡）
  for (const line of Object.values(net.lines)) {
    svg.append(s('polyline', { points: pts(net, line.stations), stroke: line.color, class: `rail-line${leg ? ' dim' : ''}` }));
    for (const e of line.endLabels ?? []) svg.append(s('text', { x: e.x, y: e.y, class: `rail-end${leg ? ' dim' : ''}`, 'text-anchor': e.anchor }, e.text));
  }
  // 這段要搭的（粗線＋流動的虛線表示方向）
  for (const r of rides) {
    svg.append(s('polyline', { points: pts(net, r.path), stroke: r.line.color, class: 'rail-ride' }), s('polyline', { points: pts(net, r.path), class: 'rail-flow' }));
  }
  // 換乘步行：上一段的下車站到下一段的上車站
  if (leg) {
    let prev: string | null = null;
    for (const sg of leg.segs) {
      if (!('line' in sg)) continue;
      if (prev && prev !== sg.from) svg.append(s('line', { x1: net.stations[prev].x, y1: net.stations[prev].y, x2: net.stations[sg.from].x, y2: net.stations[sg.from].y, class: 'rail-walk' }));
      prev = sg.to;
    }
  }
  // 站點與站名
  for (const [id, st] of Object.entries(net.stations)) {
    const on = used.has(id);
    const isEnd = ends.has(id);
    const lp = labelPos(st);
    const g = s('g', { class: `rail-st${leg && !on ? ' dim' : ''}${isEnd ? ' end' : ''}` });
    g.append(s('circle', { cx: st.x, cy: st.y, r: isEnd ? 9 : 6 }));
    g.append(s('text', { x: lp.x, y: lp.y, 'text-anchor': lp.anchor, class: 'rail-name' }, st.name + (st.code ? ` ${st.code}` : '')));
    svg.append(g);
  }
  for (const p of net.pois) svg.append(s('text', { x: p.x, y: p.y, class: `rail-poi${leg ? ' dim' : ''}`, 'text-anchor': 'middle' }, `${p.icon} ${p.name}`));
  return svg;
}

/** 從目前的範圍平滑拉到新範圍（減少動態效果時直接跳過去） */
function zoomTo(svg: SVGSVGElement, from: Box, to: Box): void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  const t0 = performance.now();
  const dur = 650;
  svg.setAttribute('viewBox', `${from.x} ${from.y} ${from.w} ${from.h}`);
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    const v = (a: number, b: number) => a + (b - a) * e;
    svg.setAttribute('viewBox', `${v(from.x, to.x)} ${v(from.y, to.y)} ${v(from.w, to.w)} ${v(from.h, to.h)}`);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function stepsView(net: Network, leg: Leg): HTMLElement {
  let n = 0;
  return h(
    'ol',
    { class: 'rail-steps' },
    leg.segs.map((sg) => {
      if (!('line' in sg)) return h('li', { class: 'rail-step walk' }, h('span', { class: 'rail-badge walk' }, '🚶'), h('div', {}, h('b', {}, '轉乘'), h('p', {}, sg.walk)));
      n += 1;
      const line = net.lines[sg.line];
      const r = ride(net, sg.line, sg.from, sg.to);
      const a = net.stations[sg.from];
      const b = net.stations[sg.to];
      const name = (st: Station) => st.name + (st.zh ? `（${st.zh}）` : '') + (st.code ? ` ${st.code}` : '');
      const badge = h('span', { class: 'rail-badge' }, String(n));
      badge.style.background = line.color;
      const lineTag = h('span', { class: 'rail-linetag' }, line.name);
      lineTag.style.borderColor = line.color;
      lineTag.style.color = line.color;
      return h(
        'li',
        { class: 'rail-step' },
        badge,
        h(
          'div',
          {},
          h('div', { class: 'rail-step-head' }, lineTag, h('span', { class: 'rail-kind' }, line.kind)),
          h('p', { class: 'rail-ride-text' }, h('b', {}, name(a)), ' → ', h('b', {}, name(b))),
          h('p', { class: 'rail-dir' }, '月台找：', h('b', {}, r.dir)),
          h('p', { class: 'rail-meta' }, r.stops != null ? `坐 ${r.stops} 站` : '', sg.info ? (r.stops != null ? '・' : '') + sg.info : ''),
          sg.tip ? h('p', { class: 'rail-tip' }, '💡 ' + sg.tip) : null,
        ),
      );
    }),
  );
}

/** 電車分頁：上面選行程，中間地圖，下面步驟 */
export function railView(data: RailData, tripId: string, selected: string, onPick: (legId: string) => void): HTMLElement {
  const legIds = Object.keys(data.legs);
  const leg = data.legs[selected] ?? null;
  const svg = mapSvg(data.network, leg);
  const chips = h(
    'nav',
    { class: 'day-strip store-strip rail-picks', 'aria-label': '選擇要看的路線' },
    h('button', { type: 'button', class: `day-pick c0${leg ? '' : ' on'}`, onclick: () => onPick('') }, h('span', { class: 'pick-n' }, '🗺️ 總圖')),
    legIds.map((id, i) =>
      h('button', { type: 'button', class: `day-pick c${(i % 4) + 1}${id === selected ? ' on' : ''}`, 'aria-current': id === selected ? 'page' : null, onclick: () => onPick(id) }, h('span', { class: 'pick-n' }, data.legs[id].title)),
    ),
  );
  const view = h(
    'div',
    { class: 'days rail' },
    chips,
    h('figure', { class: 'card rail-map' }, svg, h('figcaption', {}, leg ? '粗線是要搭的路段，虛線箭頭是行進方向；灰色虛線是走路轉乘。示意圖不照實際比例。' : '示意圖，只畫這趟會搭到的線，不照實際比例。上面選一段行程看怎麼搭。')),
    leg ? stepsView(data.network, leg) : h('p', { class: 'empty' }, `這趟共 ${legIds.length} 段要搭電車，點上面的按鈕看每一段。`),
  );
  view.dataset.trip = tripId;
  return view;
}

/** 換選擇時讓地圖從上一個範圍滑過去 */
export function animateRail(root: HTMLElement, data: RailData, prev: string, next: string): void {
  const svg = root.querySelector<SVGSVGElement>('.rail-svg');
  if (!svg) return;
  const box = (id: string) => (data.legs[id] ? legBox(data.network, data.legs[id]) : FULL_VIEW);
  zoomTo(svg, box(prev), box(next));
}
