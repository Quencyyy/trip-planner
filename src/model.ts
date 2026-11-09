// 資料格式與純函式（不碰 DOM，方便測試）

export const ITEM_TYPES = ['spot', 'food', 'transport', 'flight', 'stay', 'other'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export const TYPE_LABEL: Record<ItemType, string> = {
  spot: '景點',
  food: '吃飯',
  transport: '交通',
  flight: '航班',
  stay: '住宿',
  other: '其他',
};
export const TYPE_ICON: Record<ItemType, string> = {
  spot: '🎡',
  food: '🍜',
  transport: '🚃',
  flight: '✈️',
  stay: '🏨',
  other: '📌',
};

export type Booking = 'none' | 'todo' | 'done';
export const BOOKING_LABEL: Record<Booking, string> = { none: '不需要', todo: '待訂', done: '已訂' };

export interface Item {
  id: string;
  type: ItemType;
  time: string; // "09:30"，可空白
  endTime: string; // 結束時間，可空白
  title: string;
  place: string; // 地點文字，用來產生 Google 地圖連結
  note: string;
  // 交通／航班
  from: string;
  to: string;
  steps: string[]; // 一行一步，例如「南海電鐵 → 難波站」
  ticket: string; // 怎麼買票
  duration: string; // 手動填的時長，例如「6min」；空白就用起訖時間算
  // 通用
  spent: Expense[]; // 當天實際花費（記帳）
  booking: Booking;
  link: string; // 官網、訂位或地圖連結
}

/** 一筆實際花費，金額是日圓整數 */
export interface Expense {
  id: string;
  amount: number;
  note: string;
}

export function blankItem(id = newId()): Item {
  return { id, type: 'spot', time: '', endTime: '', title: '', place: '', note: '', from: '', to: '', steps: [], ticket: '', duration: '', spent: [], booking: 'none', link: '' };
}

export interface Day {
  date: string; // "2026-12-20"
  items: Item[];
  spent: Expense[]; // 不屬於任何項目的其他花費
}

export interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  days: Day[];
}

export interface TripSummary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
}

export interface TripIndex {
  trips: TripSummary[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 起訖日（含）之間的每一天 */
export function dateRange(start: string, end: string): string[] {
  if (!isDate(start) || !isDate(end) || start > end) return [];
  const out: string[] = [];
  const d = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  while (d <= last && out.length < 366) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * 依新日期區間重排 days。保留同日期的項目；
 * 回傳被移出區間、但還有項目或記帳的日期（呼叫端要擋下或提醒）。
 */
export function resizeDays(days: Day[], start: string, end: string): { days: Day[]; dropped: string[] } {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const range = dateRange(start, end);
  const keep = new Set(range);
  const dropped = days.filter((d) => !keep.has(d.date) && (d.items.length > 0 || d.spent.length > 0)).map((d) => d.date);
  return { days: range.map((date) => byDate.get(date) ?? { date, items: [], spent: [] }), dropped };
}

export function summarize(t: Trip): TripSummary {
  return { id: t.id, title: t.title, startDate: t.startDate, endDate: t.endDate };
}

/** 更新或加入索引，依出發日由新到舊排序 */
export function upsertIndex(index: TripIndex, s: TripSummary): TripIndex {
  const trips = index.trips.filter((t) => t.id !== s.id);
  trips.push(s);
  trips.sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
  return { trips };
}

export function removeFromIndex(index: TripIndex, id: string): TripIndex {
  return { trips: index.trips.filter((t) => t.id !== id) };
}

/** 項目依時間排序時用：空白時間保持原位置（穩定排序） */
export function sortByTime(items: Item[]): Item[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      if (!a.it.time || !b.it.time) return a.i - b.i;
      return a.it.time < b.it.time ? -1 : a.it.time > b.it.time ? 1 : a.i - b.i;
    })
    .map((x) => x.it);
}

/** 旅程 id：只允許小寫英數與連字號（會當檔名） */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isValidId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(id);
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** UTF-8 字串 ↔ base64（GitHub Contents API 用） */
export function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** "12/20（六）" */
export function formatDay(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WEEKDAYS[d.getUTCDay()]}）`;
}

export function formatRange(start: string, end: string): string {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  if (ys === ye) return `${ys}/${ms}/${ds} – ${me}/${de}`;
  return `${ys}/${ms}/${ds} – ${ye}/${me}/${de}`;
}

/** 本機時區的今天 */
export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function mapsUrl(place: string): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place);
}

/** 讀進來的 JSON 做基本檢查，缺欄位補預設值 */
export function normalizeTrip(raw: unknown): Trip {
  const r = raw as Partial<Trip>;
  if (!r || typeof r !== 'object' || typeof r.id !== 'string') throw new Error('行程資料格式不正確');
  const startDate = String(r.startDate ?? '');
  const endDate = String(r.endDate ?? '');
  const days = Array.isArray(r.days) ? r.days : [];
  const { days: fixed } = resizeDays(
    days.map((d) => ({
      date: String(d.date),
      items: (Array.isArray(d.items) ? d.items : []).map(normalizeItem),
      spent: normalizeExpenses(d.spent),
    })),
    startDate,
    endDate,
  );
  return { id: r.id, title: String(r.title ?? ''), startDate, endDate, days: fixed };
}

function normalizeItem(raw: unknown): Item {
  const it = (raw ?? {}) as Partial<Record<keyof Item, unknown>>;
  const str = (v: unknown) => (v == null ? '' : String(v));
  const type = ITEM_TYPES.includes(it.type as ItemType) ? (it.type as ItemType) : 'spot';
  const booking = (['none', 'todo', 'done'] as const).includes(it.booking as Booking) ? (it.booking as Booking) : 'none';
  return {
    id: str(it.id) || newId(),
    type,
    time: str(it.time),
    endTime: str(it.endTime),
    title: str(it.title),
    place: str(it.place),
    note: str(it.note),
    from: str(it.from),
    to: str(it.to),
    steps: Array.isArray(it.steps) ? it.steps.map(str).filter(Boolean) : [],
    ticket: str(it.ticket),
    duration: str(it.duration),
    spent: normalizeExpenses(it.spent),
    booking,
    link: str(it.link),
  };
}

export const MAX_AMOUNT = 10_000_000;

/** 使用者輸入的金額：允許逗號、¥、全形數字；不合法回傳 null */
export function parseAmount(input: string): number | null {
  const t = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s¥￥円]/g, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= MAX_AMOUNT ? n : null;
}

export function formatYen(n: number): string {
  return '¥' + n.toLocaleString('en-US');
}

function normalizeExpenses(raw: unknown): Expense[] {
  if (!Array.isArray(raw)) return [];
  const out: Expense[] = [];
  for (const r of raw) {
    const e = (r ?? {}) as Partial<Record<keyof Expense, unknown>>;
    const amount = Math.round(Number(e.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) continue;
    out.push({ id: e.id == null || e.id === '' ? newId() : String(e.id), amount, note: e.note == null ? '' : String(e.note) });
  }
  return out;
}

function compactExpense(e: Expense): Partial<Expense> {
  return e.note ? { id: e.id, amount: e.amount, note: e.note } : { id: e.id, amount: e.amount };
}

export const sumExpenses = (list: Expense[]): number => list.reduce((a, e) => a + e.amount, 0);

/** 一天的總花費（項目＋其他） */
export function dayTotal(d: Day): number {
  return sumExpenses(d.spent) + d.items.reduce((a, it) => a + sumExpenses(it.spent), 0);
}

export function tripTotal(t: Trip): number {
  return t.days.reduce((a, d) => a + dayTotal(d), 0);
}

/** 找到記帳要加的地方：itemId 為空字串就是那天的其他花費 */
export function expenseList(t: Trip, date: string, itemId: string): Expense[] | null {
  const d = t.days.find((x) => x.date === date);
  if (!d) return null;
  if (!itemId) return d.spent;
  return d.items.find((x) => x.id === itemId)?.spent ?? null;
}

/** 存檔前把空白的選填欄位拿掉，JSON 比較好讀 */
export function compactItem(it: Item): Partial<Item> {
  const out: Record<string, unknown> = { id: it.id, type: it.type };
  for (const [k, v] of Object.entries(it)) {
    if (k === 'id' || k === 'type') continue;
    if (v === '' || v === 'none' || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = k === 'spent' ? (v as Expense[]).map(compactExpense) : v;
  }
  return out as Partial<Item>;
}

export function compactTrip(t: Trip): unknown {
  return {
    ...t,
    days: t.days.map((d) => (d.spent.length ? { date: d.date, items: d.items.map(compactItem), spent: d.spent.map(compactExpense) } : { date: d.date, items: d.items.map(compactItem) })),
  };
}

function minutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 「1.5hr」「30min」；跨午夜也算得出來 */
export function durationLabel(it: Pick<Item, 'time' | 'endTime' | 'duration'> & { type?: ItemType }): string {
  if (it.duration) return it.duration;
  // 航班起降時間是各地當地時間，有時差，不自動算
  if (it.type === 'flight') return '';
  const a = minutes(it.time);
  const b = minutes(it.endTime);
  if (a == null || b == null) return '';
  let d = b - a;
  if (d <= 0) d += 24 * 60;
  if (d < 60) return `${d}min`;
  const hr = Math.round((d / 60) * 10) / 10;
  return `${hr}hr`;
}

export function directionsUrl(from: string, to: string): string {
  return (
    'https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=' + encodeURIComponent(from) + '&destination=' + encodeURIComponent(to)
  );
}

const isMove = (it: Item) => it.type === 'transport' || it.type === 'flight';

/**
 * 第 i 個項目前面要不要放「怎麼去」連結：
 * 前後都不是交通項目、都有地點、而且地點不同。回傳 [起點, 終點] 或 null。
 */
export function routeBefore(items: Item[], i: number): [string, string] | null {
  if (i <= 0) return null;
  const a = items[i - 1];
  const b = items[i];
  if (isMove(a) || isMove(b)) return null;
  if (!a.place.trim() || !b.place.trim() || a.place.trim() === b.place.trim()) return null;
  return [a.place.trim(), b.place.trim()];
}

export interface BookingRow {
  date: string;
  item: Item;
}

/** 整趟旅程需要預約的項目，待訂在前 */
export function bookingRows(t: Trip): { todo: BookingRow[]; done: BookingRow[] } {
  const todo: BookingRow[] = [];
  const done: BookingRow[] = [];
  for (const d of t.days) {
    for (const item of d.items) {
      if (item.booking === 'todo') todo.push({ date: d.date, item });
      else if (item.booking === 'done') done.push({ date: d.date, item });
    }
  }
  return { todo, done };
}
