// 查看頁：旅程列表、旅程內容、今天

import { fetchIndex, fetchTrip } from './data';
import { h, mount } from './dom';
import { formatDay, formatRange, localToday, mapsUrl, type Day, type Item, type Trip } from './model';

export async function renderHome(root: HTMLElement): Promise<void> {
  document.title = '旅遊計劃';
  const index = await fetchIndex();
  const today = localToday();
  mount(root,
    h('header', { class: 'top' }, h('h1', {}, '旅遊計劃')),
    index.trips.length === 0
      ? h('p', { class: 'empty' }, '還沒有行程。')
      : h(
          'ul',
          { class: 'trip-list' },
          index.trips.map((t) => {
            const now = t.startDate <= today && today <= t.endDate;
            const past = t.endDate < today;
            return h(
              'li',
              {},
              h(
                'a',
                { class: `trip-card${past ? ' past' : ''}`, href: `#/t/${t.id}` },
                h('span', { class: 'trip-title' }, t.title || t.id),
                h('span', { class: 'trip-dates' }, formatRange(t.startDate, t.endDate)),
                now ? h('span', { class: 'badge' }, '旅行中') : null,
              ),
            );
          }),
        ),
    h('footer', { class: 'foot' }, h('a', { href: '#/edit' }, '編輯')),
  );
}

function itemView(it: Item): HTMLElement {
  return h(
    'li',
    { class: 'item' },
    h('div', { class: 'item-time' }, it.time || ''),
    h(
      'div',
      { class: 'item-body' },
      h('div', { class: 'item-title' }, it.title || '（未命名）'),
      it.place
        ? h('a', { class: 'item-place', href: mapsUrl(it.place), target: '_blank', rel: 'noopener' }, '📍 ' + it.place)
        : null,
      it.note ? h('div', { class: 'item-note' }, it.note) : null,
    ),
  );
}

function dayView(day: Day, n: number, today: string): HTMLElement {
  const isToday = day.date === today;
  return h(
    'section',
    { class: `day${isToday ? ' today' : ''}`, id: `d-${day.date}` },
    h(
      'h2',
      { class: 'day-head' },
      h('span', { class: 'day-n' }, `第 ${n} 天`),
      h('span', { class: 'day-date' }, formatDay(day.date)),
      isToday ? h('span', { class: 'badge' }, '今天') : null,
    ),
    day.items.length === 0 ? h('p', { class: 'day-empty' }, '自由活動') : h('ol', { class: 'items' }, day.items.map(itemView)),
  );
}

export async function renderTrip(root: HTMLElement, id: string, onlyToday: boolean): Promise<void> {
  const trip: Trip = await fetchTrip(id);
  document.title = `${trip.title}｜旅遊計劃`;
  const today = localToday();
  const inTrip = trip.startDate <= today && today <= trip.endDate;
  const days = onlyToday ? trip.days.filter((d) => d.date === today) : trip.days;

  mount(root,
    h(
      'header',
      { class: 'top' },
      h('a', { class: 'back', href: '#/', 'aria-label': '回到列表' }, '‹'),
      h('div', { class: 'top-text' }, h('h1', {}, trip.title || trip.id), h('div', { class: 'sub' }, formatRange(trip.startDate, trip.endDate))),
    ),
    inTrip
      ? h(
          'nav',
          { class: 'tabs' },
          h('a', { href: `#/t/${id}`, class: onlyToday ? '' : 'on' }, '全部'),
          h('a', { href: `#/t/${id}/today`, class: onlyToday ? 'on' : '' }, '今天'),
        )
      : null,
    onlyToday && days.length === 0
      ? h('p', { class: 'empty' }, '今天不在這趟旅程的日期內。')
      : h('div', { class: 'days' }, days.map((d) => dayView(d, trip.days.indexOf(d) + 1, today))),
    h('footer', { class: 'foot' }, h('a', { href: `#/edit/${id}` }, '編輯這趟行程')),
  );

  // 旅行中打開全部行程時，自動捲到今天
  if (!onlyToday && inTrip) {
    requestAnimationFrame(() => document.getElementById(`d-${today}`)?.scrollIntoView({ block: 'start' }));
  }
}
