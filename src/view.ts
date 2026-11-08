// 查看頁：旅程列表、旅程內容、今天、預約

import { fetchIndex, fetchTrip } from './data';
import { h, mount } from './dom';
import {
  BOOKING_LABEL,
  TYPE_ICON,
  TYPE_LABEL,
  bookingRows,
  directionsUrl,
  durationLabel,
  formatDay,
  formatRange,
  localToday,
  mapsUrl,
  routeBefore,
  type Day,
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

function itemView(it: Item): HTMLElement {
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
      it.cost || it.ticket
        ? h('div', { class: 'item-meta' }, it.cost ? chip('💰 ' + it.cost, 'cost') : null, it.ticket ? chip('🎫 ' + it.ticket, 'ticket') : null)
        : null,
      it.note ? h('div', { class: 'item-note' }, it.note) : null,
      h(
        'div',
        { class: 'item-links' },
        isMove && it.from && it.to && it.type === 'transport'
          ? h('a', { href: directionsUrl(it.from, it.to), target: '_blank', rel: 'noopener' }, '🗺️ 看路線')
          : null,
        it.link && !(it.place && /maps/.test(it.link)) ? h('a', { href: it.link, target: '_blank', rel: 'noopener' }, '🔗 相關連結') : null,
      ),
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

function itemsView(items: Item[]): HTMLElement {
  const out: HTMLElement[] = [];
  items.forEach((it, i) => {
    const r = routeBefore(items, i);
    if (r) out.push(routeView(r[0], r[1]));
    out.push(itemView(it));
  });
  return h('ol', { class: 'items' }, out);
}

function dayView(day: Day, n: number, today: string): HTMLElement {
  const isToday = day.date === today;
  return h(
    'section',
    { class: `day c${(n - 1) % 5}${isToday ? ' today' : ''}`, id: `d-${day.date}` },
    h(
      'h2',
      { class: 'day-head' },
      h('span', { class: 'day-n' }, `Day ${n}`),
      h('span', { class: 'day-date' }, formatDay(day.date)),
      isToday ? h('span', { class: 'badge' }, '今天') : null,
    ),
    day.items.length === 0 ? h('p', { class: 'day-empty' }, '自由活動 ☁️') : itemsView(day.items),
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

export async function renderTrip(root: HTMLElement, id: string, tab: 'all' | 'today' | 'book'): Promise<void> {
  const trip: Trip = await fetchTrip(id);
  document.title = `${trip.title}｜旅遊計劃`;
  const today = localToday();
  const inTrip = trip.startDate <= today && today <= trip.endDate;
  const todoCount = bookingRows(trip).todo.length;

  let body: HTMLElement;
  if (tab === 'book') body = bookingView(trip);
  else {
    const days = tab === 'today' ? trip.days.filter((d) => d.date === today) : trip.days;
    body =
      tab === 'today' && days.length === 0
        ? h('p', { class: 'empty' }, '今天不在這趟旅程的日期內。')
        : h('div', { class: 'days' }, days.map((d) => dayView(d, trip.days.indexOf(d) + 1, today)));
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
      h('a', { href: `#/t/${id}`, class: tab === 'all' ? 'on' : '' }, '全部'),
      inTrip ? h('a', { href: `#/t/${id}/today`, class: tab === 'today' ? 'on' : '' }, '今天') : null,
      h('a', { href: `#/t/${id}/book`, class: tab === 'book' ? 'on' : '' }, '預約', todoCount ? h('span', { class: 'dot' }, String(todoCount)) : null),
    ),
    body,
    h('footer', { class: 'foot' }, h('a', { href: `#/edit/${id}` }, '✏️ 編輯這趟行程')),
  );

  if (tab === 'all' && inTrip) {
    requestAnimationFrame(() => document.getElementById(`d-${today}`)?.scrollIntoView({ block: 'start' }));
  }
}
