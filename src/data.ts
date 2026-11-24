// 查看頁讀網站上發佈的資料檔（不需要權杖）

import { isValidId, normalizeTrip, type Guide, type GuideGroup, type ShopStore, type Trip, type TripIndex } from './model';
import type { Leg, Network, RailData } from './rail';

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(res.status === 404 ? '找不到這份資料' : `讀取失敗（${res.status}）`);
  return res.json();
}

export const INDEX_PATH = 'public/data/index.json';
export const tripPath = (id: string) => `public/data/trips/${id}.json`;

export async function fetchIndex(): Promise<TripIndex> {
  const j = (await getJson('./data/index.json')) as TripIndex;
  return { trips: Array.isArray(j?.trips) ? j.trips : [] };
}

export async function fetchTrip(id: string): Promise<Trip> {
  return normalizeTrip(await getJson(`./data/trips/${encodeURIComponent(id)}.json`));
}

const groups = (v: unknown): GuideGroup[] =>
  (Array.isArray(v) ? v : []).map((g) => ({
    title: String(g?.title ?? ''),
    items: (Array.isArray(g?.items) ? g.items : []).map((it: Record<string, unknown>) => ({
      id: String(it?.id ?? ''),
      text: String(it?.text ?? ''),
      hint: it?.hint ? String(it.hint) : undefined,
      link: typeof it?.link === 'string' && /^https:\/\//.test(it.link) ? it.link : undefined,
      img: typeof it?.img === 'string' && /^https:\/\//.test(it.img) ? it.img : undefined,
      q: it?.q ? String(it.q) : undefined,
    })),
  }));

/** 電車路線圖：data/rail/<行程>.json 指定用哪張網路圖、每段交通怎麼搭；沒有這個檔就不顯示分頁 */
export async function fetchRail(tripId: string): Promise<RailData> {
  const j = (await getJson(`./data/rail/${encodeURIComponent(tripId)}.json`)) as { network?: string; legs?: Record<string, Leg> };
  if (!j?.network || !isValidId(j.network) || !j.legs) throw new Error('路線圖資料格式不正確');
  const network = (await getJson(`./data/rail/${j.network}.json`)) as Network;
  return { network, legs: j.legs };
}

export async function fetchGuide(name: string): Promise<Guide> {
  if (!isValidId(name)) throw new Error('清單名稱不正確');
  const j = (await getJson(`./data/guides/${name}.json`)) as Record<string, unknown>;
  return { title: String(j?.title ?? ''), updated: String(j?.updated ?? ''), before: groups(j?.before),
    during: groups(j?.during),
    after: groups(j?.after),
    shop: (Array.isArray(j?.shop) ? j.shop : [])
      .map((s: Record<string, unknown>) => ({
        id: String(s?.id ?? ''),
        title: String(s?.title ?? ''),
        sub: s?.sub ? String(s.sub) : undefined,
        hint: s?.hint ? String(s.hint) : undefined,
        groups: groups(s?.groups),
      }))
      .filter((s: ShopStore) => isValidId(s.id) && s.groups.length),
    links: groups(j?.links)
      .map((g) => ({ ...g, items: g.items.filter((it) => it.link) }))
      .filter((g) => g.items.length),
  };
}
