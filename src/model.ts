// 資料格式與純函式（不碰 DOM，方便測試）

export interface Item {
  id: string;
  time: string; // "09:30"，可空白
  title: string;
  place: string; // 地點文字，用來產生 Google 地圖連結
  note: string;
}

export interface Day {
  date: string; // "2026-12-20"
  items: Item[];
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
 * 回傳被移出區間、但還有項目的日期（呼叫端要擋下或提醒）。
 */
export function resizeDays(days: Day[], start: string, end: string): { days: Day[]; dropped: string[] } {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const range = dateRange(start, end);
  const keep = new Set(range);
  const dropped = days.filter((d) => !keep.has(d.date) && d.items.length > 0).map((d) => d.date);
  return { days: range.map((date) => byDate.get(date) ?? { date, items: [] }), dropped };
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
      items: (Array.isArray(d.items) ? d.items : []).map((it) => ({
        id: String(it.id ?? newId()),
        time: String(it.time ?? ''),
        title: String(it.title ?? ''),
        place: String(it.place ?? ''),
        note: String(it.note ?? ''),
      })),
    })),
    startDate,
    endDate,
  );
  return { id: r.id, title: String(r.title ?? ''), startDate, endDate, days: fixed };
}
