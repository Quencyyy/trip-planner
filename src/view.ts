// 查看頁：旅程列表、旅程內容、今天、預約

import { fetchIndex, fetchTrip } from './data';
import { h, mount, toast } from './dom';
import { GitHubError, isReady, loadSettings } from './github';
import { addExpense, loadLatest, removeExpense, type Target } from './ledger';
import {
  BOOKING_LABEL,
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
      it.steps.length ? h('ol', { class: 'steps' }, it.steps.map((s) => h('li', {}, s))) : null,
      it.place ? h('a', { class: 'item-place', href: it.link && !isMove && /maps/.test(it.link) ? it.link : mapsUrl(it.place), target: '_blank', rel: 'noopener' }, '📍 ' + it.place) : null,
      it.ticket ? h('div', { class: 'item-meta' }, chip('🎫 ' + it.ticket, 'ticket')) : null,
      it.note ? h('div', { class: 'item-note' }, it.note) : null,
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

function moneyView(trip: Trip): HTMLElement {
  const total = tripTotal(trip);
  return h(
    'div',
    { class: 'days' },
    h('section', { class: 'card money-total' }, h('div', { class: 'money-label' }, '整趟花費'), h('div', { class: 'money-big' }, formatYen(total))),
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
                h('li', { class: 'bk-row' }, h('span', { class: 'bk-title' }, r.what, r.e.note ? h('small', {}, r.e.note) : null), h('span', { class: 'money-amt' }, formatYen(r.e.amount))),
              ),
            )
          : h('p', { class: 'day-empty' }, '還沒有記帳'),
      );
    }),
  );
}

export type TripTab = 'day' | 'book' | 'money';

export async function renderTrip(root: HTMLElement, id: string, tab: TripTab, wantDate = ''): Promise<void> {
  const s = loadSettings();
  let canEdit = isReady(s);
  let tokenProblem = '';
  let trip: Trip;
  if (canEdit) {
    // 有權杖時直接讀 GitHub 上最新的，剛記的帳不用等網站更新
    try {
      const latest = await loadLatest(s, id);
      if (!latest) throw new Error('GitHub 上找不到這趟行程');
      trip = latest.trip;
    } catch (e) {
      if (!(e instanceof GitHubError)) throw e;
      canEdit = false;
      tokenProblem = e.message;
      trip = await fetchTrip(id);
    }
  } else {
    trip = await fetchTrip(id);
  }
  document.title = `${trip.title}｜旅遊計劃`;
  const today = localToday();
  const inTrip = trip.startDate <= today && today <= trip.endDate;
  // 只顯示一天：網址指定的那天 → 旅行中就今天 → 還沒出發或已結束就第一天
  const has = (d: string) => trip.days.some((x) => x.date === d);
  let selDate = has(wantDate) ? wantDate : inTrip && has(today) ? today : (trip.days[0]?.date ?? '');
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
  const keyOf = (w: Target) => `${w.date}|${w.itemId}`;

  async function run(job: () => Promise<Trip>, done: string): Promise<void> {
    if (busy) return;
    busy = true;
    root.classList.add('busy');
    try {
      trip = await job();
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
          void run(() => addExpense(s, trip.id, where, n, note.value.trim()), `已記帳 ${formatYen(n)}`);
        },
      },
      amount,
      note,
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
      const text = `${formatYen(e.amount)}${e.note ? ' ' + e.note : ''}`;
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
    else if (tab === 'money') body = moneyView(trip);
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
    const total = tripTotal(trip);

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
        h('a', { href: `#/t/${id}/money`, class: tab === 'money' ? 'on' : '' }, '記帳', total ? h('span', { class: 'dot money' }, formatYen(total)) : null),
      ),
      tokenProblem
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
