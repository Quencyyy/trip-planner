// 查看頁讀網站上發佈的資料檔（不需要權杖）

import { normalizeTrip, type Trip, type TripIndex } from './model';

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
