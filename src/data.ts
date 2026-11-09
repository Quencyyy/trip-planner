// 查看頁讀網站上發佈的資料檔（不需要權杖）

import { isValidId, normalizeTrip, type Guide, type GuideGroup, type Trip, type TripIndex } from './model';

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
    })),
  }));

export async function fetchGuide(name: string): Promise<Guide> {
  if (!isValidId(name)) throw new Error('清單名稱不正確');
  const j = (await getJson(`./data/guides/${name}.json`)) as Record<string, unknown>;
  return { title: String(j?.title ?? ''), updated: String(j?.updated ?? ''), before: groups(j?.before),
    during: groups(j?.during),
    after: groups(j?.after),
    links: groups(j?.links)
      .map((g) => ({ ...g, items: g.items.filter((it) => it.link) }))
      .filter((g) => g.items.length),
  };
}
