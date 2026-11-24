import { describe, expect, it } from 'vitest';
import netRaw from '../public/data/rail/kansai.json?raw';
import tripRaw from '../public/data/rail/2026-11-osaka.json?raw';
import { FULL_VIEW, focusBox, legBox, ride, type Network, type RailData } from './rail';

const net = JSON.parse(netRaw) as Network;
const trip = JSON.parse(tripRaw) as { legs: RailData['legs'] };

describe('ride（一段搭乘）', () => {
  it('心齋橋到難波：往なかもず方向、1 站', () => {
    const r = ride(net, 'midosuji', 'm-shinsaibashi', 'm-namba');
    expect(r.path).toEqual(['m-shinsaibashi', 'm-namba']);
    expect(r.dir).toContain('なかもず');
    expect(r.stops).toBe(1);
  });
  it('反方向：心齋橋到梅田，往千里中央、3 站', () => {
    const r = ride(net, 'midosuji', 'm-shinsaibashi', 'm-umeda');
    expect(r.path[0]).toBe('m-shinsaibashi');
    expect(r.path.at(-1)).toBe('m-umeda');
    expect(r.dir).toContain('千里中央');
    expect(r.stops).toBe(3);
  });
  it('長堀鶴見綠地線到森之宮：往門真南、5 站', () => {
    const r = ride(net, 'nagahori', 'm-shinsaibashi', 'n-morinomiya');
    expect(r.dir).toContain('門真南');
    expect(r.stops).toBe(5);
  });
  it('只畫主要站的線不算站數', () => {
    expect(ride(net, 'keihan', 'kh-yodoyabashi', 'kh-gionshijo').stops).toBeNull();
  });
  it('不存在的線或站會報錯', () => {
    expect(() => ride(net, 'nope', 'a', 'b')).toThrow();
    expect(() => ride(net, 'midosuji', 'm-umeda', 'k-kix')).toThrow();
  });
});

describe('行程資料', () => {
  it('每一段的起訖站都在那條線上，拉近範圍在總圖裡面附近、比例一致', () => {
    for (const [id, leg] of Object.entries(trip.legs)) {
      for (const s of leg.segs) if ('line' in s) expect(() => ride(net, s.line, s.from, s.to), id).not.toThrow();
      const b = legBox(net, leg);
      expect(b.w / b.h).toBeCloseTo(FULL_VIEW.w / FULL_VIEW.h, 1);
      expect(b.w).toBeLessThanOrEqual(FULL_VIEW.w * 1.2);
    }
  });
});

describe('focusBox（點第幾步只拉近那一段）', () => {
  it('關西機場→心齋橋：第 1 步是南海，範圍比整段小、包含關西機場', () => {
    const leg = trip.legs.i02;
    const one = focusBox(net, leg, 1);
    const all = legBox(net, leg);
    const kix = net.stations['k-kix'];
    expect(one.w).toBeLessThanOrEqual(all.w);
    expect(kix.x).toBeGreaterThan(one.x);
    expect(kix.x).toBeLessThan(one.x + one.w);
  });
  it('超出範圍（例如走路那一步）就看整段', () => {
    expect(focusBox(net, trip.legs.i20, 9)).toEqual(legBox(net, trip.legs.i20));
  });
});
