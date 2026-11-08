// 編輯頁：設定權杖、新增旅程、拖拉排行程、存回 GitHub

import Sortable from 'sortablejs';
import { INDEX_PATH, fetchIndex, fetchTrip, tripPath } from './data';
import { h, mount, toast } from './dom';
import { GitHubError, checkAccess, clearToken, deleteFile, getFile, isReady, loadSettings, putFile, saveSettings, type RepoSettings } from './github';
import {
  dateRange,
  formatDay,
  formatRange,
  isDate,
  isValidId,
  newId,
  normalizeTrip,
  removeFromIndex,
  resizeDays,
  slugify,
  sortByTime,
  summarize,
  upsertIndex,
  type Item,
  type Trip,
  type TripIndex,
} from './model';

let dirty = false;
let pendingNew: Trip | null = null;
let sortables: Sortable[] = [];

export function isDirty(): boolean {
  return dirty;
}
export function clearDirty(): void {
  dirty = false;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function loadIndex(s: RepoSettings): Promise<{ index: TripIndex; sha?: string }> {
  if (!isReady(s)) return { index: await fetchIndex() };
  const f = await getFile(s, INDEX_PATH);
  if (!f) return { index: { trips: [] } };
  const j = JSON.parse(f.text) as TripIndex;
  return { index: { trips: Array.isArray(j.trips) ? j.trips : [] }, sha: f.sha };
}

function notReadyBanner(): HTMLElement {
  return h(
    'div',
    { class: 'banner' },
    '目前是預覽模式：可以試著編輯，但不能儲存。要儲存請先到 ',
    h('a', { href: '#/settings' }, '設定'),
    ' 貼上 GitHub 權杖。',
  );
}

/* ---------- 編輯首頁 ---------- */

export async function renderEditHome(root: HTMLElement): Promise<void> {
  document.title = '編輯｜旅遊計劃';
  const s = loadSettings();
  let index: TripIndex;
  let tokenProblem = '';
  try {
    ({ index } = await loadIndex(s));
  } catch (e) {
    // 權杖壞掉時仍要能進到設定頁，所以改讀網站上的資料
    if (!(e instanceof GitHubError)) throw e;
    tokenProblem = e.message;
    index = await fetchIndex();
  }

  const idIn = h('input', { name: 'id', required: true, placeholder: '例如 2026-12-tokyo', pattern: '[a-z0-9][a-z0-9\\-]*', autocapitalize: 'off' });
  const titleIn = h('input', { name: 'title', required: true, placeholder: '例如 東京五天' });
  const startIn = h('input', { name: 'start', type: 'date', required: true });
  const endIn = h('input', { name: 'end', type: 'date', required: true });
  startIn.addEventListener('change', () => {
    if (!endIn.value || endIn.value < startIn.value) endIn.value = startIn.value;
    if (!idIn.value && startIn.value) idIn.value = startIn.value.slice(0, 7) + '-';
  });

  const form = h(
    'form',
    {
      class: 'card form',
      onsubmit: (ev: Event) => {
        ev.preventDefault();
        const id = slugify(idIn.value);
        if (!isValidId(id)) return toast('網址代號只能用小寫英文、數字和 -', 'err');
        if (index.trips.some((t) => t.id === id)) return toast('這個網址代號已經用過了', 'err');
        if (!isDate(startIn.value) || !isDate(endIn.value) || endIn.value < startIn.value) return toast('日期不正確', 'err');
        if (dateRange(startIn.value, endIn.value).length > 60) return toast('一趟最多 60 天', 'err');
        pendingNew = {
          id,
          title: titleIn.value.trim(),
          startDate: startIn.value,
          endDate: endIn.value,
          days: dateRange(startIn.value, endIn.value).map((date) => ({ date, items: [] })),
        };
        location.hash = `#/edit/${id}`;
      },
    },
    h('h2', {}, '新增行程'),
    h('label', {}, '名稱', titleIn),
    h('div', { class: 'row' }, h('label', {}, '出發', startIn), h('label', {}, '回程', endIn)),
    h('label', {}, '網址代號', idIn, h('small', {}, '會出現在網址裡，只能用小寫英文、數字和 -')),
    h('button', { class: 'primary', type: 'submit' }, '建立'),
  );

  mount(root,
    h('header', { class: 'top' }, h('a', { class: 'back', href: '#/', 'aria-label': '回到列表' }, '‹'), h('div', { class: 'top-text' }, h('h1', {}, '編輯'))),
    tokenProblem
      ? h('div', { class: 'banner banner-err' }, tokenProblem + '。', h('a', { href: '#/settings' }, '前往設定'))
      : isReady(s)
        ? null
        : notReadyBanner(),
    h(
      'ul',
      { class: 'trip-list' },
      index.trips.map((t) =>
        h(
          'li',
          {},
          h('a', { class: 'trip-card', href: `#/edit/${t.id}` }, h('span', { class: 'trip-title' }, t.title || t.id), h('span', { class: 'trip-dates' }, formatRange(t.startDate, t.endDate))),
        ),
      ),
    ),
    form,
    h('footer', { class: 'foot' }, h('a', { href: '#/settings' }, '設定')),
  );
}

/* ---------- 設定 ---------- */

export function renderSettings(root: HTMLElement): void {
  document.title = '設定｜旅遊計劃';
  const s = loadSettings();
  const owner = h('input', { value: s.owner, placeholder: 'GitHub 帳號', autocapitalize: 'off' });
  const repo = h('input', { value: s.repo, placeholder: 'repo 名稱', autocapitalize: 'off' });
  const branch = h('input', { value: s.branch, autocapitalize: 'off' });
  const token = h('input', { type: 'password', value: s.token, placeholder: 'github_pat_…', autocomplete: 'off' });
  const read = (): RepoSettings => ({ owner: owner.value.trim(), repo: repo.value.trim(), branch: branch.value.trim() || 'main', token: token.value.trim() });

  mount(root,
    h('header', { class: 'top' }, h('a', { class: 'back', href: '#/edit', 'aria-label': '回到編輯' }, '‹'), h('div', { class: 'top-text' }, h('h1', {}, '設定'))),
    h(
      'form',
      {
        class: 'card form',
        onsubmit: async (ev: Event) => {
          ev.preventDefault();
          const next = read();
          try {
            if (next.token) await checkAccess(next);
            saveSettings(next);
            toast(next.token ? '權杖可用，已儲存' : '已儲存');
            location.hash = '#/edit';
          } catch (e) {
            toast(errMsg(e), 'err');
          }
        },
      },
      h('label', {}, 'GitHub 帳號', owner),
      h('label', {}, 'Repo', repo),
      h('label', {}, '分支', branch),
      h('label', {}, '權杖', token),
      h(
        'p',
        { class: 'help' },
        '到 GitHub → Settings → Developer settings → Fine-grained tokens 建立權杖，只選這個 repo，權限給 Contents: Read and write。權杖只會存在這台裝置的瀏覽器裡。',
      ),
      h('div', { class: 'row' }, h('button', { class: 'primary', type: 'submit' }, '測試並儲存'), h('button', {
        type: 'button',
        onclick: () => {
          clearToken();
          token.value = '';
          toast('已從這台裝置移除權杖');
        },
      }, '移除權杖')),
    ),
  );
}

/* ---------- 行程編輯器 ---------- */

export async function renderEditor(root: HTMLElement, id: string): Promise<void> {
  const s = loadSettings();
  const ready = isReady(s);
  let trip: Trip;
  let sha: string | undefined;
  let isNew = false;

  if (pendingNew?.id === id) {
    trip = pendingNew;
    pendingNew = null;
    isNew = true;
    dirty = true;
  } else if (ready) {
    const f = await getFile(s, tripPath(id));
    if (!f) throw new Error('GitHub 上找不到這趟行程');
    trip = normalizeTrip(JSON.parse(f.text));
    sha = f.sha;
    dirty = false;
  } else {
    trip = await fetchTrip(id);
    dirty = false;
  }
  document.title = `編輯 ${trip.title}｜旅遊計劃`;

  const items = new Map<string, Item>();
  const openIds = new Set<string>();
  let saving = false;

  const saveBtn = h('button', { class: 'primary', type: 'button' }, '儲存');
  const daysBox = h('div', { class: 'days' });

  function markDirty(): void {
    dirty = true;
    refreshSave();
  }
  function refreshSave(): void {
    saveBtn.disabled = !ready || !dirty || saving;
    saveBtn.textContent = saving ? '儲存中…' : dirty ? '儲存' : '已儲存';
  }

  /** 依 DOM 順序重建每天的項目（拖拉後呼叫） */
  function syncFromDom(): void {
    const before = JSON.stringify(trip.days.map((d) => d.items.map((i) => i.id)));
    for (const ol of daysBox.querySelectorAll<HTMLOListElement>('ol.items')) {
      const day = trip.days.find((d) => d.date === ol.dataset.date);
      if (!day) continue;
      day.items = [...ol.children].map((li) => items.get((li as HTMLElement).dataset.id!)).filter((x): x is Item => Boolean(x));
    }
    renderDays();
    if (JSON.stringify(trip.days.map((d) => d.items.map((i) => i.id))) !== before) markDirty();
  }

  function itemEditor(it: Item): HTMLElement {
    const open = openIds.has(it.id);
    const sumTime = h('span', { class: 'item-time' }, it.time);
    const sumTitle = h('span', { class: 'item-title' }, it.title || '（未命名）');
    const field = <K extends 'time' | 'title' | 'place' | 'note'>(k: K, el: HTMLInputElement | HTMLTextAreaElement) => {
      el.value = it[k];
      el.addEventListener('input', () => {
        it[k] = el.value;
        if (k === 'time') sumTime.textContent = el.value;
        if (k === 'title') sumTitle.textContent = el.value || '（未命名）';
        markDirty();
      });
      return el;
    };
    const li = h(
      'li',
      { class: `edit-item${open ? ' open' : ''}`, 'data-id': it.id },
      h(
        'div',
        { class: 'edit-sum' },
        h('span', { class: 'handle', 'aria-label': '拖拉排序', title: '拖拉排序' }, '⋮⋮'),
        h(
          'button',
          {
            type: 'button',
            class: 'sum-btn',
            onclick: () => {
              if (openIds.has(it.id)) openIds.delete(it.id);
              else openIds.add(it.id);
              li.classList.toggle('open');
            },
          },
          sumTime,
          sumTitle,
        ),
      ),
      h(
        'div',
        { class: 'edit-fields' },
        h(
          'div',
          { class: 'row' },
          h('label', { class: 'narrow' }, '時間', field('time', h('input', { type: 'time' }))),
          h('label', {}, '標題', field('title', h('input', { placeholder: '要做什麼' }))),
        ),
        h('label', {}, '地點', field('place', h('input', { placeholder: '會變成 Google 地圖連結' }))),
        h('label', {}, '備註', field('note', h('textarea', { rows: 2 }))),
        h(
          'button',
          {
            type: 'button',
            class: 'danger small',
            onclick: () => {
              if (!confirm(`刪除「${it.title || '未命名'}」？`)) return;
              for (const d of trip.days) d.items = d.items.filter((x) => x.id !== it.id);
              items.delete(it.id);
              renderDays();
              markDirty();
            },
          },
          '刪除這個項目',
        ),
      ),
    );
    return li;
  }

  function renderDays(): void {
    for (const so of sortables) so.destroy();
    sortables = [];
    items.clear();
    daysBox.replaceChildren(
      ...trip.days.map((day, i) => {
        day.items.forEach((it) => items.set(it.id, it));
        const ol = h('ol', { class: 'items edit-items', 'data-date': day.date }, day.items.map(itemEditor));
        sortables.push(
          Sortable.create(ol, {
            group: 'items',
            handle: '.handle',
            animation: 150,
            // 用指標事件模擬拖拉，手機和桌面行為一致
            forceFallback: true,
            fallbackTolerance: 4,
            ghostClass: 'ghost',
            onEnd: syncFromDom,
          }),
        );
        return h(
          'section',
          { class: 'day' },
          h(
            'h2',
            { class: 'day-head' },
            h('span', { class: 'day-n' }, `第 ${i + 1} 天`),
            h('span', { class: 'day-date' }, formatDay(day.date)),
            day.items.length > 1
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'link small',
                    onclick: () => {
                      day.items = sortByTime(day.items);
                      renderDays();
                      markDirty();
                    },
                  },
                  '依時間排序',
                )
              : null,
          ),
          ol,
          h(
            'button',
            {
              type: 'button',
              class: 'add',
              onclick: () => {
                const it: Item = { id: newId(), time: '', title: '', place: '', note: '' };
                day.items.push(it);
                openIds.add(it.id);
                renderDays();
                markDirty();
                daysBox.querySelector<HTMLInputElement>(`li[data-id="${it.id}"] input[type=time]`)?.focus();
              },
            },
            '＋ 新增項目',
          ),
        );
      }),
    );
  }

  const titleIn = h('input', { value: trip.title });
  titleIn.addEventListener('input', () => {
    trip.title = titleIn.value;
    markDirty();
  });
  const startIn = h('input', { type: 'date', value: trip.startDate });
  const endIn = h('input', { type: 'date', value: trip.endDate });
  const onDates = () => {
    const start = startIn.value;
    const end = endIn.value;
    if (!isDate(start) || !isDate(end) || end < start || dateRange(start, end).length > 60) {
      toast('日期不正確（回程不能早於出發，最多 60 天）', 'err');
      startIn.value = trip.startDate;
      endIn.value = trip.endDate;
      return;
    }
    const { days, dropped } = resizeDays(trip.days, start, end);
    if (dropped.length) {
      toast(`${dropped.map(formatDay).join('、')} 還有項目，先把它們移到其他天或刪除`, 'err');
      startIn.value = trip.startDate;
      endIn.value = trip.endDate;
      return;
    }
    trip.startDate = start;
    trip.endDate = end;
    trip.days = days;
    renderDays();
    markDirty();
  };
  startIn.addEventListener('change', onDates);
  endIn.addEventListener('change', onDates);

  async function save(): Promise<void> {
    if (!ready || saving || !dirty) return;
    if (!trip.title.trim()) return toast('請填名稱', 'err');
    saving = true;
    refreshSave();
    try {
      const json = JSON.stringify(trip, null, 2) + '\n';
      sha = await putFile(s, tripPath(trip.id), json, sha, `${isNew ? '新增' : '更新'}行程：${trip.title}`);
      isNew = false;
      const { index, sha: idxSha } = await loadIndex(s);
      const next = upsertIndex(index, summarize(trip));
      if (JSON.stringify(next) !== JSON.stringify(index)) {
        await putFile(s, INDEX_PATH, JSON.stringify(next, null, 2) + '\n', idxSha, `更新行程列表：${trip.title}`);
      }
      dirty = false;
      toast('已儲存。網站約 1～2 分鐘後更新');
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      saving = false;
      refreshSave();
    }
  }
  saveBtn.addEventListener('click', save);

  async function removeTrip(): Promise<void> {
    if (!ready) return toast('預覽模式不能刪除', 'err');
    if (!confirm(`確定刪除「${trip.title}」？網站上會看不到這趟行程（Git 紀錄裡仍可找回）。`)) return;
    try {
      if (sha) await deleteFile(s, tripPath(trip.id), sha, `刪除行程：${trip.title}`);
      const { index, sha: idxSha } = await loadIndex(s);
      if (index.trips.some((t) => t.id === trip.id)) {
        await putFile(s, INDEX_PATH, JSON.stringify(removeFromIndex(index, trip.id), null, 2) + '\n', idxSha, `更新行程列表：移除 ${trip.title}`);
      }
      dirty = false;
      toast('已刪除');
      location.hash = '#/edit';
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  }

  mount(root,
    h(
      'header',
      { class: 'top sticky' },
      h('a', { class: 'back', href: '#/edit', 'aria-label': '回到編輯' }, '‹'),
      h('div', { class: 'top-text' }, h('h1', {}, '編輯行程'), isNew ? null : h('a', { class: 'sub', href: `#/t/${trip.id}` }, '查看網頁')),
      saveBtn,
    ),
    ready ? null : notReadyBanner(),
    h(
      'div',
      { class: 'card form' },
      h('label', {}, '名稱', titleIn),
      h('div', { class: 'row' }, h('label', {}, '出發', startIn), h('label', {}, '回程', endIn)),
    ),
    daysBox,
    h('footer', { class: 'foot' }, isNew ? null : h('button', { type: 'button', class: 'danger small', onclick: removeTrip }, '刪除這趟行程')),
  );
  renderDays();
  refreshSave();
}

/** Cmd/Ctrl+S 儲存 */
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    const btn = document.querySelector<HTMLButtonElement>('header.top button.primary');
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  }
});
