// 日圓→台幣匯率：用 open.er-api.com 的免費公開匯率（不需要金鑰、不送出任何個人資料）。
// 存在這台裝置 12 小時；沒網路時用上次的。

const KEY = 'trip-planner:rate:JPY-TWD';
const TTL = 12 * 60 * 60 * 1000;

interface Cached {
  rate: number;
  at: number; // 抓到的時間
}

function readCache(): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cached | null;
    return c && c.rate > 0 && c.rate < 10 ? c : null;
  } catch {
    return null;
  }
}

/** 抓最新匯率；fresh=false 時 12 小時內用快取。失敗回傳上次的（可能是 null） */
export async function liveRate(fresh = false): Promise<Cached | null> {
  const cached = readCache();
  if (!fresh && cached && Date.now() - cached.at < TTL) return cached;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY', { cache: 'no-store' });
    const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const rate = Number(j?.rates?.TWD);
    if (j?.result !== 'success' || !(rate > 0 && rate < 10)) return cached;
    const next = { rate, at: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* 存不了就算了 */
    }
    return next;
  } catch {
    return cached;
  }
}
