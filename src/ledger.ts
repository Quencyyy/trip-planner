// 查看頁的快速記帳：每次只改一筆，存之前先抓 GitHub 上最新的檔案再套用，
// 避免蓋掉別台裝置剛存的內容。

import { tripPath } from './data';
import { GitHubError, getFile, putFile, type RepoSettings } from './github';
import { compactTrip, expenseList, newId, normalizeTrip, type Expense, type Trip } from './model';

export interface Target {
  date: string;
  itemId: string; // 空字串＝那天的其他花費
}

/** 讀 GitHub 上最新的行程（含 sha） */
export async function loadLatest(s: RepoSettings, id: string): Promise<{ trip: Trip; sha: string } | null> {
  const f = await getFile(s, tripPath(id));
  if (!f) return null;
  return { trip: normalizeTrip(JSON.parse(f.text)), sha: f.sha };
}

async function update(s: RepoSettings, id: string, change: (t: Trip) => void, message: string): Promise<Trip> {
  for (let attempt = 0; ; attempt++) {
    const latest = await loadLatest(s, id);
    if (!latest) throw new Error('GitHub 上找不到這趟行程');
    change(latest.trip);
    try {
      await putFile(s, tripPath(id), JSON.stringify(compactTrip(latest.trip), null, 2) + '\n', latest.sha, message);
      return latest.trip;
    } catch (e) {
      // 剛好有別人同時存檔：重抓一次再套用
      if (e instanceof GitHubError && e.status === 409 && attempt < 2) continue;
      throw e;
    }
  }
}

function listOrThrow(t: Trip, where: Target): Expense[] {
  const list = expenseList(t, where.date, where.itemId);
  if (!list) throw new Error('這個項目已經被刪除或移到別天，請重新整理');
  return list;
}

export function addExpense(s: RepoSettings, tripId: string, where: Target, amount: number, note: string): Promise<Trip> {
  return update(s, tripId, (t) => listOrThrow(t, where).push({ id: newId(), amount, note }), `記帳：${where.date} ¥${amount}${note ? ' ' + note : ''}`);
}

export function removeExpense(s: RepoSettings, tripId: string, where: Target, expenseId: string): Promise<Trip> {
  return update(
    s,
    tripId,
    (t) => {
      const list = listOrThrow(t, where);
      const i = list.findIndex((e) => e.id === expenseId);
      if (i >= 0) list.splice(i, 1);
    },
    `刪除記帳：${where.date}`,
  );
}
