import { describe, expect, it } from 'vitest';
import {
  blankItem,
  bookingRows,
  compactItem,
  durationLabel,
  routeBefore,
  type Item,
  base64ToUtf8,
  dateRange,
  formatDay,
  isDate,
  isValidId,
  normalizeTrip,
  removeFromIndex,
  resizeDays,
  slugify,
  sortByTime,
  upsertIndex,
  utf8ToBase64,
} from './model';

const item = (id: string, time = '', extra: Partial<Item> = {}): Item => ({ ...blankItem(id), title: id, time, ...extra });

describe('日期', () => {
  it('isDate 擋掉不存在的日期', () => {
    expect(isDate('2026-02-28')).toBe(true);
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-2-3')).toBe(false);
  });
  it('dateRange 含頭尾、可跨月', () => {
    expect(dateRange('2026-11-30', '2026-12-02')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
    expect(dateRange('2026-12-02', '2026-11-30')).toEqual([]);
  });
  it('formatDay 顯示星期', () => {
    expect(formatDay('2026-11-08')).toBe('11/8（日）');
  });
});

describe('resizeDays', () => {
  const days = [
    { date: '2026-11-07', items: [item('a')] },
    { date: '2026-11-08', items: [] },
    { date: '2026-11-09', items: [item('b')] },
  ];
  it('延長時保留原項目、補空白天', () => {
    const r = resizeDays(days, '2026-11-07', '2026-11-10');
    expect(r.dropped).toEqual([]);
    expect(r.days.map((d) => d.date)).toEqual(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']);
    expect(r.days[2].items[0].id).toBe('b');
  });
  it('縮短時回報有項目被移出的日期', () => {
    expect(resizeDays(days, '2026-11-07', '2026-11-08').dropped).toEqual(['2026-11-09']);
    expect(resizeDays(days, '2026-11-08', '2026-11-09').dropped).toEqual(['2026-11-07']);
    expect(resizeDays(days, '2026-11-07', '2026-11-09').dropped).toEqual([]);
  });
});

describe('索引', () => {
  it('upsert 取代同 id 並依出發日新到舊', () => {
    let idx = { trips: [{ id: 'a', title: 'A', startDate: '2026-01-01', endDate: '2026-01-02' }] };
    idx = upsertIndex(idx, { id: 'b', title: 'B', startDate: '2026-05-01', endDate: '2026-05-02' });
    idx = upsertIndex(idx, { id: 'a', title: 'A2', startDate: '2026-01-01', endDate: '2026-01-03' });
    expect(idx.trips.map((t) => t.title)).toEqual(['B', 'A2']);
    expect(removeFromIndex(idx, 'b').trips.map((t) => t.id)).toEqual(['a']);
  });
});

describe('其他', () => {
  it('sortByTime 空白時間不亂跳', () => {
    expect(sortByTime([item('x', '15:00'), item('y', '09:00'), item('z')]).map((i) => i.id)).toEqual(['y', 'x', 'z']);
  });
  it('slugify／isValidId', () => {
    expect(slugify('2026 Tokyo 五天!')).toBe('2026-tokyo');
    expect(isValidId('2026-tokyo')).toBe(true);
    expect(isValidId('-x')).toBe(false);
    expect(isValidId('../x')).toBe(false);
  });
  it('base64 來回保留中文與 emoji', () => {
    const s = '京都三日 📍 清水寺';
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });
  it('normalizeTrip 補欄位、依日期區間補天數', () => {
    const t = normalizeTrip({ id: 'x', title: 'X', startDate: '2026-01-01', endDate: '2026-01-02', days: [{ date: '2026-01-02', items: [{ title: 'hi' }] }] });
    expect(t.days.length).toBe(2);
    expect(t.days[1].items[0]).toMatchObject({ title: 'hi', time: '', place: '', note: '' });
    expect(() => normalizeTrip(null)).toThrow();
  });
});

describe('交通與預約', () => {
  it('durationLabel：手動優先、跨午夜、小時一位小數', () => {
    expect(durationLabel({ time: '13:10', endTime: '14:40', duration: '' })).toBe('1.5hr');
    expect(durationLabel({ time: '14:40', endTime: '14:50', duration: '' })).toBe('10min');
    expect(durationLabel({ time: '14:40', endTime: '14:50', duration: '6min' })).toBe('6min');
    expect(durationLabel({ time: '23:30', endTime: '00:30', duration: '' })).toBe('1hr');
    expect(durationLabel({ time: '10:00', endTime: '', duration: '' })).toBe('');
  });
  it('routeBefore：只在兩個有地點、非交通、地點不同的項目之間', () => {
    const items = [
      item('a', '', { place: '道頓堀' }),
      item('b', '', { place: '黑門市場' }),
      item('c', '', { place: '黑門市場' }),
      item('d', '', { type: 'transport', from: 'x', to: 'y' }),
      item('e', '', { place: '梅田' }),
      item('f'),
    ];
    expect(routeBefore(items, 0)).toBeNull();
    expect(routeBefore(items, 1)).toEqual(['道頓堀', '黑門市場']);
    expect(routeBefore(items, 2)).toBeNull();
    expect(routeBefore(items, 3)).toBeNull();
    expect(routeBefore(items, 4)).toBeNull();
    expect(routeBefore(items, 5)).toBeNull();
  });
  it('bookingRows 分待訂／已訂', () => {
    const t = { id: 't', title: '', startDate: '2026-01-01', endDate: '2026-01-01', days: [{ date: '2026-01-01', items: [item('a', '', { booking: 'todo' }), item('b', '', { booking: 'done' }), item('c')] }] };
    const r = bookingRows(t);
    expect(r.todo.map((x) => x.item.id)).toEqual(['a']);
    expect(r.done.map((x) => x.item.id)).toEqual(['b']);
  });
  it('compactItem 拿掉空欄位，normalizeTrip 能讀回來', () => {
    const it0 = item('a', '10:00', { type: 'transport', steps: ['南海電鐵'] });
    const c = compactItem(it0);
    expect(c).toEqual({ id: 'a', type: 'transport', time: '10:00', title: 'a', steps: ['南海電鐵'] });
    const back = normalizeTrip({ id: 't', title: '', startDate: '2026-01-01', endDate: '2026-01-01', days: [{ date: '2026-01-01', items: [c] }] });
    expect(back.days[0].items[0]).toEqual(it0);
  });
});

describe('航班時長', () => {
  it('航班不自動算（有時差），手動填的照用', () => {
    expect(durationLabel({ type: 'flight', time: '06:05', endTime: '09:30', duration: '' })).toBe('');
    expect(durationLabel({ type: 'flight', time: '06:05', endTime: '09:30', duration: '2h25m' })).toBe('2h25m');
  });
});
