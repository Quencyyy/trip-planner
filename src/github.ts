// 透過 GitHub Contents API 讀寫 repo 裡的資料檔。權杖只存在使用者自己的瀏覽器。

import { base64ToUtf8, utf8ToBase64 } from './model';

export interface RepoSettings {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

const KEY = 'trip-planner:github';

/** 在 <owner>.github.io/<repo>/ 上時，自動推出 owner 和 repo */
export function guessRepo(loc: Location = location): { owner: string; repo: string } | null {
  const m = loc.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  if (!m) return null;
  const seg = loc.pathname.split('/').filter(Boolean)[0];
  return { owner: m[1], repo: seg ?? `${m[1]}.github.io` };
}

export function loadSettings(): RepoSettings {
  let saved: Partial<RepoSettings> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    /* 私密視窗等情況讀不到，就當沒有 */
  }
  const g = guessRepo();
  return {
    owner: saved.owner || g?.owner || '',
    repo: saved.repo || g?.repo || '',
    branch: saved.branch || 'main',
    token: saved.token || '',
  };
}

export function saveSettings(s: RepoSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new Error('瀏覽器不允許儲存設定（可能是私密瀏覽模式）');
  }
}

export function clearToken(): void {
  const s = loadSettings();
  saveSettings({ ...s, token: '' });
}

export function isReady(s: RepoSettings): boolean {
  return Boolean(s.owner && s.repo && s.branch && s.token);
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function apiUrl(s: RepoSettings, path: string): string {
  const p = path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${p}`;
}

/** 連不上網路（不是 GitHub 拒絕） */
export class NetworkError extends Error {}

async function call(s: RepoSettings, url: string, init: RequestInit = {}): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new NetworkError('沒有網路，這次沒有存到');
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${s.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new NetworkError('連不上網路，這次沒有存到');
  }
  if (res.ok || res.status === 404) return res;
  let msg = `GitHub 回應 ${res.status}`;
  if (res.status === 401) msg = '權杖無效或已過期，請到「設定」重新貼上';
  else if (res.status === 403) msg = '權杖沒有寫入這個 repo 的權限（需要 Contents: Read and write）';
  else if (res.status === 409) msg = '檔案在別處被改過了，請重新載入後再存';
  else if (res.status === 422) msg = 'GitHub 拒絕這次儲存（可能是檔案版本不符），請重新載入';
  throw new GitHubError(res.status, msg);
}

export interface RemoteFile {
  text: string;
  sha: string;
}

export async function getFile(s: RepoSettings, path: string): Promise<RemoteFile | null> {
  const res = await call(s, `${apiUrl(s, path)}?ref=${encodeURIComponent(s.branch)}`);
  if (res.status === 404) return null;
  const j = await res.json();
  return { text: base64ToUtf8(j.content), sha: j.sha };
}

/** 寫入檔案，回傳新的 sha。sha 為 undefined 表示新檔 */
export async function putFile(s: RepoSettings, path: string, text: string, sha: string | undefined, message: string): Promise<string> {
  const res = await call(s, apiUrl(s, path), {
    method: 'PUT',
    body: JSON.stringify({ message, content: utf8ToBase64(text), branch: s.branch, ...(sha ? { sha } : {}) }),
  });
  if (res.status === 404) throw new GitHubError(404, '找不到 repo 或分支，請檢查「設定」');
  const j = await res.json();
  return j.content.sha;
}

export async function deleteFile(s: RepoSettings, path: string, sha: string, message: string): Promise<void> {
  const res = await call(s, apiUrl(s, path), {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch: s.branch }),
  });
  if (res.status === 404) return;
}

/** 測試權杖：能讀 repo 且有 push 權限 */
export async function checkAccess(s: RepoSettings): Promise<void> {
  const res = await call(s, `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}`);
  if (res.status === 404) throw new GitHubError(404, '找不到這個 repo，或權杖沒有它的權限');
  const j = await res.json();
  if (!j.permissions?.push) throw new GitHubError(403, '權杖沒有寫入權限（需要 Contents: Read and write）');
}
