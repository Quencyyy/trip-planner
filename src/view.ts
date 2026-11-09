// 查看頁：旅程列表、旅程內容、今天、預約

import { fetchGuide, fetchIndex, fetchTrip } from './data';
import { h, mount, toast } from './dom';
import { GitHubError, NetworkError, isReady, loadSettings } from './github';
import { liveRate } from './rate';
import { addExpense, loadLatest, removeExpense, type Target } from './ledger';
import {
  BOOKING_LABEL,
  PAY_ICON,
  PAY_LABEL,
  allExpenses,
  formatTwd,
  normalizeTrip,
  settle,
  type Pay,
  TYPE_ICON,
  TYPE_LABEL,
  bookingRows,
  dayTotal,
  directionsUrl,
  durationLabel,
  formatDay,
  formatRange,
  formatYen,
  localToday,
  mapsUrl,
  parseAmount,
  routeBefore,
  sumExpenses,
  tripTotal,
  type Day,
  type Expense,
  type Guide,
  type GuideGroup,
  type Item,
  type Trip,
} from './model';

/** Q 版小雲朵吉祥物 */
export function mascot(size = 56): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 120 100');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String((size * 100) / 120));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('mascot');
  svg.innerHTML = `
    <path class="m-body" d="M30 86c-15 0-25-10-25-23 0-12 9-21 21-22 2-17 16-30 34-30 15 0 28 9 32 23 14 1 23 12 23 25 0 15-11 27-27 27z"/>
    <ellipse class="m-cheek" cx="38" cy="66" rx="7" ry="4.5"/>
    <ellipse class="m-cheek" cx="82" cy="66" rx="7" ry="4.5"/>
    <circle class="m-eye" cx="45" cy="56" r="4.5"/>
    <circle class="m-eye" cx="75" cy="56" r="4.5"/>
    <circle fill="#fff" cx="46.5" cy="54.5" r="1.5"/>
    <circle fill="#fff" cx="76.5" cy="54.5" r="1.5"/>
    <path class="m-mouth" d="M55 66q5 5 10 0"/>
    <path class="m-leaf" d="M60 12c3-9 13-11 18-8-3 7-11 11-18 8z"/>`;
  return svg;
}

export async function renderHome(root: HTMLElement): Promise<void> {
  document.title = '旅遊計劃';
  const index = await fetchIndex();
  const today = localToday();
  mount(
    root,
    h('header', { class: 'hero' }, mascot(72), h('div', {}, h('h1', {}, '旅遊計劃'), h('div', { class: 'sub' }, '出發去玩吧！'))),
    index.trips.length === 0
      ? h('p', { class: 'empty' }, '還沒有行程。')
      : h(
          'ul',
          { class: 'trip-list' },
          index.trips.map((t) => {
            const now = t.startDate <= today && today <= t.endDate;
            const past = t.endDate < today;
            const days = Math.round((Date.parse(t.endDate) - Date.parse(t.startDate)) / 86400000) + 1;
            return h(
              'li',
              {},
              h(
                'a',
                { class: `trip-card${past ? ' past' : ''}`, href: `#/t/${t.id}` },
                h('span', { class: 'trip-title' }, t.title || t.id),
                h('span', { class: 'trip-dates' }, `${formatRange(t.startDate, t.endDate)}・${days} 天`),
                now ? h('span', { class: 'badge' }, '旅行中') : null,
              ),
            );
          }),
        ),
    h('footer', { class: 'foot' }, h('a', { href: '#/edit' }, '✏️ 編輯')),
  );
}

function chip(text: string, cls: string): HTMLElement {
  return h('span', { class: `chip ${cls}` }, text);
}

type SpentFor = (where: Target, list: Expense[]) => HTMLElement | null;

function itemView(it: Item, spent: HTMLElement | null): HTMLElement {
  const isMove = it.type === 'transport' || it.type === 'flight';
  const dur = durationLabel(it);
  // 平常只露出備註第一行，其餘和路線步驟收進「詳細」
  const [noteHead = '', ...rest] = it.note.split('\n');
  const noteRest = rest.join('\n').trim();
  return h(
    'li',
    { class: `item t-${it.type}` },
    h(
      'div',
      { class: 'item-left' },
      h('div', { class: 'item-time' }, it.time || ''),
      it.endTime ? h('div', { class: 'item-end' }, it.endTime) : null,
      dur ? h('span', { class: 'dur' }, dur) : null,
    ),
    h('div', { class: 'item-icon', title: TYPE_LABEL[it.type] }, TYPE_ICON[it.type]),
    h(
      'div',
      { class: 'item-body' },
      h(
        'div',
        { class: 'item-title' },
        it.title || '（未命名）',
        it.booking !== 'none' ? chip(BOOKING_LABEL[it.booking], `bk-${it.booking}`) : null,
      ),
      it.place ? h('a', { class: 'item-place', href: it.link && !isMove && /maps/.test(it.link) ? it.link : mapsUrl(it.place), target: '_blank', rel: 'noopener' }, '📍 ' + it.place) : null,
      it.ticket ? h('div', { class: 'item-meta' }, chip('🎫 ' + it.ticket, 'ticket')) : null,
      noteHead ? h('div', { class: 'item-note' }, noteHead) : null,
      it.steps.length || noteRest
        ? h(
            'details',
            { class: 'item-more' },
            h('summary', {}, it.steps.length ? `路線 ${it.steps.length} 步` : '更多'),
            it.steps.length ? h('ol', { class: 'steps' }, it.steps.map((s) => h('li', {}, s))) : null,
            noteRest ? h('div', { class: 'item-note' }, noteRest) : null,
          )
        : null,
      h(
        'div',
        { class: 'item-links' },
        isMove && it.from && it.to && it.type === 'transport'
          ? h('a', { href: directionsUrl(it.from, it.to), target: '_blank', rel: 'noopener' }, '🗺️ 看路線')
          : null,
        it.link && !(it.place && /maps/.test(it.link)) ? h('a', { href: it.link, target: '_blank', rel: 'noopener' }, '🔗 相關連結') : null,
      ),
      spent,
    ),
  );
}

function routeView(from: string, to: string): HTMLElement {
  return h(
    'li',
    { class: 'route' },
    h('a', { href: directionsUrl(from, to), target: '_blank', rel: 'noopener', title: `${from} → ${to}` }, '🚶 怎麼去', h('span', { class: 'route-to' }, `　→ ${to}`)),
  );
}

function itemsView(day: Day, spentFor: SpentFor): HTMLElement {
  const items = day.items;
  const out: HTMLElement[] = [];
  items.forEach((it, i) => {
    const r = routeBefore(items, i);
    if (r) out.push(routeView(r[0], r[1]));
    // 「其他」多半是提醒事項，不放記帳按鈕（已有的記帳仍顯示）
    const spent = it.type === 'other' && it.spent.length === 0 ? null : spentFor({ date: day.date, itemId: it.id }, it.spent);
    out.push(itemView(it, spent));
  });
  return h('ol', { class: 'items' }, out);
}

function dayView(day: Day, n: number, today: string, spentFor: SpentFor): HTMLElement {
  const isToday = day.date === today;
  const total = dayTotal(day);
  const other = spentFor({ date: day.date, itemId: '' }, day.spent);
  return h(
    'section',
    { class: `day c${(n - 1) % 5}${isToday ? ' today' : ''}`, id: `d-${day.date}` },
    h(
      'h2',
      { class: 'day-head' },
      h('span', { class: 'day-n' }, `Day ${n}`),
      h('span', { class: 'day-date' }, formatDay(day.date)),
      isToday ? h('span', { class: 'badge' }, '今天') : null,
      total ? h('span', { class: 'day-total' }, formatYen(total)) : null,
    ),
    day.items.length === 0 ? h('p', { class: 'day-empty' }, '自由活動 ☁️') : itemsView(day, spentFor),
    other ? h('div', { class: 'day-other' }, h('span', { class: 'day-other-label' }, '🧾 其他花費'), other) : null,
  );
}

function bookingView(trip: Trip): HTMLElement {
  const { todo, done } = bookingRows(trip);
  const row = (r: { date: string; item: Item }) =>
    h(
      'li',
      { class: 'bk-row' },
      h('span', { class: 'bk-date' }, formatDay(r.date)),
      h('span', { class: 'bk-icon' }, TYPE_ICON[r.item.type]),
      h('span', { class: 'bk-title' }, `${r.item.time ? r.item.time + ' ' : ''}${r.item.title}`, r.item.note ? h('small', {}, r.item.note) : null),
    );
  return h(
    'div',
    { class: 'days' },
    h(
      'section',
      { class: 'day c3' },
      h('h2', { class: 'day-head' }, h('span', { class: 'day-n' }, '還沒訂'), h('span', { class: 'day-date' }, `${todo.length} 項`)),
      todo.length ? h('ul', { class: 'bk-list' }, todo.map(row)) : h('p', { class: 'day-empty' }, '都訂好了 🎉'),
    ),
    h(
      'section',
      { class: 'day c1' },
      h('h2', { class: 'day-head' }, h('span', { class: 'day-n' }, '已訂好'), h('span', { class: 'day-date' }, `${done.length} 項`)),
      done.length ? h('ul', { class: 'bk-list' }, done.map(row)) : h('p', { class: 'day-empty' }, '還沒有'),
    ),
  );
}

interface Rate {
  rate: number;
  label: string; // 匯率來源說明
}

function moneyView(trip: Trip, rate: Rate | null): HTMLElement {
  const total = tripTotal(trip);
  const st = settle(allExpenses(trip));
  const twd = (n: number) => (rate ? h('span', { class: 'twd' }, `≈ ${formatTwd(n, rate.rate)}`) : null);
  return h(
    'div',
    { class: 'days' },
    h(
      'section',
      { class: 'card money-total' },
      h('div', { class: 'money-label' }, '整趟花費'),
      h('div', { class: 'money-big' }, formatYen(total)),
      twd(total),
      h(
        'div',
        { class: 'pay-split' },
        h('div', {}, h('span', { class: 'money-label' }, `${PAY_ICON.card} 信用卡`), h('b', {}, formatYen(st.card))),
        h('div', {}, h('span', { class: 'money-label' }, `${PAY_ICON.cash} 現金`), h('b', {}, formatYen(st.cash))),
      ),
      h(
        'div',
        { class: 'settle' },
        total === 0
          ? '還沒有記帳'
          : st.from && st.to
            ? h('span', {}, `各付一半：${PAY_LABEL[st.from]}那位要給${PAY_LABEL[st.to]}那位 `, h('b', {}, formatYen(st.amount)), rate ? `（${formatTwd(st.amount, rate.rate)}）` : '')
            : '兩人付的剛好一樣多 🎉',
      ),
      rate ? h('small', { class: 'rate-note' }, rate.label) : null,
    ),
    trip.days.map((d, i) => {
      const rows: { what: string; e: Expense }[] = [];
      for (const it of d.items) for (const e of it.spent) rows.push({ what: `${TYPE_ICON[it.type]} ${it.title || '（未命名）'}`, e });
      for (const e of d.spent) rows.push({ what: '🧾 其他', e });
      return h(
        'section',
        { class: `day c${i % 5}` },
        h('h2', { class: 'day-head' }, h('span', { class: 'day-n' }, `Day ${i + 1}`), h('span', { class: 'day-date' }, formatDay(d.date)), dayTotal(d) ? h('span', { class: 'day-total' }, formatYen(dayTotal(d))) : null),
        rows.length
          ? h(
              'ul',
              { class: 'bk-list' },
              rows.map((r) =>
                h(
                  'li',
                  { class: 'bk-row' },
                  h('span', { class: 'bk-icon', title: PAY_LABEL[r.e.pay] }, PAY_ICON[r.e.pay]),
                  h('span', { class: 'bk-title' }, r.what, r.e.note ? h('small', {}, r.e.note) : null),
                  h('span', { class: 'money-amt' }, formatYen(r.e.amount)),
                ),
              ),
            )
          : h('p', { class: 'day-empty' }, '還沒有記帳'),
      );
    }),
  );
}

const CHECK_KEY = (tripId: string) => `trip-planner:check:${tripId}`;

function loadChecks(tripId: string): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(CHECK_KEY(tripId)) ?? '[]');
    return new Set(Array.isArray(v) ? v.map(String) : []);
  } catch {
    return new Set();
  }
}
function saveChecks(tripId: string, set: Set<string>): void {
  try {
    localStorage.setItem(CHECK_KEY(tripId), JSON.stringify([...set]));
  } catch {
    /* 私密瀏覽等情況存不了，只是打勾不會記住 */
  }
}

/** 常用連結：分組列出，整列可點 */
function linksView(groups: GuideGroup[]): HTMLElement {
  return h(
    'div',
    { class: 'days links' },
    groups.map((g, gi) =>
      h(
        'section',
        { class: `card l-group c${gi % 5}` },
        h('h2', { class: 'l-title' }, g.title),
        h(
          'ul',
          { class: 'l-list' },
          g.items.map((it) =>
            h(
              'li',
              {},
              h('a', { class: 'l-item', href: it.link!, target: '_blank', rel: 'noopener' }, h('span', {}, it.text, it.hint ? h('small', {}, it.hint) : null), h('span', { class: 'l-go', 'aria-hidden': 'true' }, '↗')),
            ),
          ),
        ),
      ),
    ),
  );
}

/** 出發前／回國清單：大標摺疊，打勾只記在這台裝置 */
function guideView(tripId: string, groups: GuideGroup[], updated: string): HTMLElement {
  const checks = loadChecks(tripId);
  return h(
    'div',
    { class: 'days guide' },
    groups.map((g, gi) => {
      const count = h('span', { class: 'g-count' });
      const refresh = () => {
        const done = g.items.filter((it) => checks.has(it.id)).length;
        count.textContent = `${done}/${g.items.length}`;
        count.classList.toggle('all', done === g.items.length);
      };
      refresh();
      return h(
        'details',
        { class: `card g-group c${gi % 5}` },
        h('summary', {}, h('span', { class: 'g-title' }, g.title), count),
        h(
          'ul',
          { class: 'g-list' },
          g.items.map((it) => {
            const box = h('input', { type: 'checkbox' });
            box.checked = checks.has(it.id);
            box.addEventListener('change', () => {
              if (box.checked) checks.add(it.id);
              else checks.delete(it.id);
              saveChecks(tripId, checks);
              refresh();
            });
            return h(
              'li',
              {},
              h('label', { class: 'g-item' }, box, h('span', {}, it.text, it.hint ? h('small', {}, it.hint) : null)),
              it.link ? h('a', { class: 'g-link', href: it.link, target: '_blank', rel: 'noopener' }, '官方說明 ↗') : null,
            );
          }),
        ),
      );
    }),
    h('p', { class: 'g-foot' }, `規定會變動，以官方說明為準（整理於 ${updated}）。打勾只存在這台。`),
  );
}

/* 這台裝置最後一次看到的行程，沒網路時拿來顯示 */
const LAST_KEY = (id: string) => `trip-planner:last:${id}`;
function saveLast(trip: Trip, fromSite = false): void {
  try {
    localStorage.setItem(LAST_KEY(trip.id), JSON.stringify({ at: Date.now(), fromSite, trip }));
  } catch {
    /* 存不了就算了 */
  }
}
function loadLast(id: string): { at: number; fromSite: boolean; trip: Trip } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY(id)) ?? 'null');
    return v?.trip ? { at: Number(v.at) || 0, fromSite: Boolean(v.fromSite), trip: normalizeTrip(v.trip) } : null;
  } catch {
    return null;
  }
}

const PAY_KEY = 'trip-planner:pay';
function loadPay(): Pay {
  try {
    return localStorage.getItem(PAY_KEY) === 'cash' ? 'cash' : 'card';
  } catch {
    return 'card';
  }
}
function savePay(p: Pay): void {
  try {
    localStorage.setItem(PAY_KEY, p);
  } catch {
    /* 存不了就每次預設信用卡 */
  }
}

export type TripTab = 'day' | 'book' | 'money' | 'notes' | 'links';
type Stage = 'before' | 'during' | 'after';
const STAGES: [Stage, string][] = [['before', '出發前'], ['during', '旅途中'], ['after', '回國']];

export async function renderTrip(root: HTMLElement, id: string, tab: TripTab, sub = ''): Promise<void> {
  const wantDate = tab === 'day' ? sub : '';
  const s = loadSettings();
  let canEdit = isReady(s);
  let tokenProblem = '';
  let offlineAt = 0; // 沒網路時顯示的是幾點存下的資料
  let trip: Trip;
  const fromCache = (e: unknown): Trip => {
    const last = loadLast(id);
    if (!last) throw e;
    offlineAt = last.at;
    canEdit = false;
    return last.trip;
  };
  if (canEdit) {
    // 有權杖時直接讀 GitHub 上最新的，剛記的帳不用等網站更新
    try {
      const latest = await loadLatest(s, id);
      if (!latest) throw new Error('GitHub 上找不到這趟行程');
      trip = latest.trip;
      saveLast(trip);
    } catch (e) {
      if (e instanceof NetworkError) trip = fromCache(e);
      else if (e instanceof GitHubError) {
        canEdit = false;
        tokenProblem = e.message;
        trip = await fetchTrip(id).catch(fromCache);
      } else throw e;
    }
  } else {
    try {
      trip = await fetchTrip(id);
      // 網站的資料可能比這台上次從 GitHub 讀到的舊，舊的就不要蓋掉
      const last = loadLast(id);
      if (!last || last.fromSite) saveLast(trip, true);
    } catch (e) {
      trip = fromCache(e);
    }
  }
  let rate: Rate | null = trip.twdRate ? { rate: trip.twdRate, label: `匯率 ${trip.twdRate}（行程設定）` } : null;
  document.title = `${trip.title}｜旅遊計劃`;
  let guide: Guide | null = null;
  if (trip.guide) {
    try {
      guide = await fetchGuide(trip.guide);
    } catch {
      guide = null; // 清單讀不到不影響行程
    }
  }
  if (tab === 'notes' && !guide) tab = 'day';
  // 常用連結：清單裡的＋這趟行程項目上的連結
  const tripLinks: GuideGroup = {
    title: '🗓️ 這趟行程',
    items: trip.days.flatMap((d) => d.items.filter((it) => it.link).map((it) => ({ id: it.id, text: it.title || '（未命名）', link: it.link }))),
  };
  const linkGroups = [...(tripLinks.items.length ? [tripLinks] : []), ...(guide?.links ?? [])];
  if (tab === 'links' && !linkGroups.length) tab = 'day';
  const today = localToday();
  const inTrip = trip.startDate <= today && today <= trip.endDate;
  // 只顯示一天：網址指定的那天 → 旅行中就今天 → 還沒出發或已結束就第一天
  const has = (d: string) => trip.days.some((x) => x.date === d);
  let selDate = has(wantDate) ? wantDate : inTrip && has(today) ? today : (trip.days[0]?.date ?? '');
  // 注意事項：網址指定的階段 → 依日期（還沒出發／旅途中／最後一天起算回國）
  let stage: Stage = STAGES.some(([k]) => k === sub) ? (sub as Stage) : today < trip.startDate ? 'before' : today < trip.endDate ? 'during' : 'after';
  const pickStage = (k: Stage) => {
    stage = k;
    history.replaceState(null, '', `#/t/${encodeURIComponent(id)}/notes/${k}`);
    draw();
    window.scrollTo(0, 0);
  };
  const pickDay = (d: string) => {
    selDate = d;
    openKey = '';
    // 換天不重新讀資料，只更新網址（可分享、重新整理後停在同一天）
    history.replaceState(null, '', `#/t/${encodeURIComponent(id)}/day/${d}`);
    draw();
    window.scrollTo(0, 0);
  };

  let openKey = ''; // 正在記帳的位置
  let busy = false;
  let pay: Pay = loadPay();
  if (!rate) {
    void liveRate().then((r) => {
      if (!r || trip.twdRate) return;
      const d = new Date(r.at);
      rate = { rate: r.rate, label: `即時匯率 ${Math.round(r.rate * 10000) / 10000}（${d.getMonth() + 1}/${d.getDate()} 更新），實際以刷卡帳單為準` };
      if (tab === 'money') draw();
    });
  }
  const keyOf = (w: Target) => `${w.date}|${w.itemId}`;

  async function run(job: () => Promise<Trip>, done: string): Promise<void> {
    if (busy) return;
    busy = true;
    root.classList.add('busy');
    try {
      trip = await job();
      saveLast(trip);
      openKey = '';
      draw();
      toast(done);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      busy = false;
      root.classList.remove('busy');
    }
  }

  function expenseForm(where: Target): HTMLElement {
    const amount = h('input', { class: 'amt', inputmode: 'numeric', placeholder: '金額 ¥', 'aria-label': '金額（日圓）', autocomplete: 'off' });
    const note = h('input', { placeholder: '買了什麼（可空白）', 'aria-label': '說明', maxlength: 40 });
    const form = h(
      'form',
      {
        class: 'spent-form',
        onsubmit: (ev: Event) => {
          ev.preventDefault();
          const n = parseAmount(amount.value);
          if (n == null) return toast('金額請填正整數（日圓）', 'err');
          void run(() => addExpense(s, trip.id, where, n, note.value.trim(), pay), `已記帳 ${PAY_ICON[pay]} ${formatYen(n)}`);
        },
      },
      amount,
      note,
      h(
        'div',
        { class: 'pay-toggle', role: 'group', 'aria-label': '付款方式' },
        (['card', 'cash'] as Pay[]).map((p) =>
          h(
            'button',
            {
              type: 'button',
              class: p === pay ? 'on' : '',
              'aria-pressed': p === pay ? 'true' : 'false',
              onclick: (ev: Event) => {
                pay = p;
                savePay(p);
                const box = (ev.currentTarget as HTMLElement).parentElement!;
                for (const b of box.children) {
                  const on = b === ev.currentTarget;
                  b.classList.toggle('on', on);
                  b.setAttribute('aria-pressed', on ? 'true' : 'false');
                }
              },
            },
            `${PAY_ICON[p]} ${PAY_LABEL[p]}`,
          ),
        ),
      ),
      h(
        'div',
        { class: 'btns' },
        h('button', { class: 'small', type: 'button', onclick: () => ((openKey = ''), draw()) }, '取消'),
        h('button', { class: 'primary small', type: 'submit' }, '記下'),
      ),
    );
    requestAnimationFrame(() => amount.focus());
    return form;
  }

  const spentFor: SpentFor = (where, list) => {
    if (!canEdit && list.length === 0) return null;
    const chips = list.map((e) => {
      const text = `${PAY_ICON[e.pay]} ${formatYen(e.amount)}${e.note ? ' ' + e.note : ''}`;
      return canEdit
        ? h(
            'button',
            {
              type: 'button',
              class: 'chip spent',
              title: '點一下刪除',
              onclick: () => {
                if (confirm(`刪除這筆記帳？\n${text}`)) void run(() => removeExpense(s, trip.id, where, e.id), '已刪除這筆');
              },
            },
            text,
          )
        : chip(text, 'spent');
    });
    return h(
      'div',
      { class: 'spent-box' },
      chips.length > 1 ? h('span', { class: 'spent-sum' }, `共 ${formatYen(sumExpenses(list))}`) : null,
      ...chips,
      canEdit
        ? openKey === keyOf(where)
          ? expenseForm(where)
          : h('button', { type: 'button', class: 'add-spent', onclick: () => ((openKey = keyOf(where)), draw()) }, '＋ 記帳')
        : null,
    );
  };

  function draw(): void {
    const y = window.scrollY;
    const todoCount = bookingRows(trip).todo.length;
    let body: HTMLElement;
    if (tab === 'book') body = bookingView(trip);
    else if (tab === 'money') body = moneyView(trip, rate);
    else if (tab === 'notes' && guide)
      body = h(
        'div',
        { class: 'days' },
        h(
          'nav',
          { class: 'day-strip stage-strip', 'aria-label': '選擇階段' },
          STAGES.map(([k, label], n) =>
            h('button', { type: 'button', class: `day-pick c${n + 1}${k === stage ? ' on' : ''}`, 'aria-current': k === stage ? 'step' : null, onclick: () => pickStage(k) }, h('span', { class: 'pick-n' }, label)),
          ),
        ),
        guideView(trip.id, guide[stage], guide.updated),
      );
    else if (tab === 'links') body = linksView(linkGroups);
    else {
      const i = trip.days.findIndex((d) => d.date === selDate);
      body =
        i < 0
          ? h('p', { class: 'empty' }, '這趟行程還沒有日期。')
          : h(
              'div',
              { class: 'days' },
              h(
                'nav',
                { class: 'day-strip', 'aria-label': '選擇日期' },
                trip.days.map((d, n) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      class: `day-pick c${n % 5}${d.date === selDate ? ' on' : ''}${d.date === today ? ' is-today' : ''}`,
                      'aria-current': d.date === selDate ? 'date' : null,
                      onclick: () => pickDay(d.date),
                    },
                    h('span', { class: 'pick-n' }, d.date === today ? '今天' : `Day ${n + 1}`),
                    h('span', { class: 'pick-date' }, `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}`),
                  ),
                ),
              ),
              dayView(trip.days[i], i + 1, today, spentFor),
            );
    }

    mount(
      root,
      h(
        'header',
        { class: 'top' },
        h('a', { class: 'back', href: '#/', 'aria-label': '回到列表' }, '‹'),
        h('div', { class: 'top-text' }, h('h1', {}, trip.title || trip.id), h('div', { class: 'sub' }, formatRange(trip.startDate, trip.endDate))),
        mascot(44),
      ),
      h(
        'nav',
        { class: 'tabs' },
        h('a', { href: `#/t/${id}/day/${selDate}`, class: tab === 'day' ? 'on' : '' }, '行程'),
        h('a', { href: `#/t/${id}/book`, class: tab === 'book' ? 'on' : '' }, '預約', todoCount ? h('span', { class: 'dot' }, String(todoCount)) : null),
        h('a', { href: `#/t/${id}/money`, class: tab === 'money' ? 'on' : '' }, '記帳'),
        guide ? h('a', { href: `#/t/${id}/notes/${stage}`, class: tab === 'notes' ? 'on' : '' }, '注意事項') : null,
        linkGroups.length ? h('a', { href: `#/t/${id}/links`, class: tab === 'links' ? 'on' : '' }, '連結') : null,
      ),
      offlineAt
        ? h('div', { class: 'banner banner-err' }, `沒有網路：顯示 ${new Date(offlineAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} 存在這台的資料，現在不能記帳。`)
        : tokenProblem
        ? h('div', { class: 'banner banner-err' }, tokenProblem + '。現在只能看，不能記帳。', h('a', { href: '#/settings' }, '前往設定'))
        : tab === 'money'
          ? canEdit
            ? h('div', { class: 'banner' }, '記帳會存到 GitHub。repo 是公開的，知道網址的人都看得到金額。')
            : h('div', { class: 'banner' }, '目前只能看。要記帳請先到 ', h('a', { href: '#/settings' }, '設定'), ' 貼上 GitHub 權杖。')
          : null,
      body,
      h('footer', { class: 'foot' }, h('a', { href: `#/edit/${id}` }, '✏️ 編輯這趟行程')),
    );
    window.scrollTo(0, y);
  }

  draw();
}
