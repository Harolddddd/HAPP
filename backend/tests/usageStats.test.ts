import { calculateContinuousUsers, calculateAvgDailyActiveUsers, calculateTopFeatures } from '../src/utils/usageStats';

function dateNDaysBefore(base: string, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('calculateContinuousUsers', () => {
  const today = '2026-07-19';

  it('returns all zeros when there are no events', () => {
    expect(calculateContinuousUsers([], today)).toEqual({ days90: 0, days60: 0, days30: 0 });
  });

  it('counts a user with a 90-day streak in all three buckets', () => {
    const events = Array.from({ length: 90 }, (_, i) => ({ userId: 'u1', date: dateNDaysBefore(today, i) }));
    expect(calculateContinuousUsers(events, today)).toEqual({ days90: 1, days60: 1, days30: 1 });
  });

  it('counts a user with a 40-day streak only in the 30-day bucket', () => {
    const events = Array.from({ length: 40 }, (_, i) => ({ userId: 'u1', date: dateNDaysBefore(today, i) }));
    expect(calculateContinuousUsers(events, today)).toEqual({ days90: 0, days60: 0, days30: 1 });
  });

  it('counts multiple users independently, ignoring a non-consecutive event', () => {
    const events = [
      ...Array.from({ length: 90 }, (_, i) => ({ userId: 'u1', date: dateNDaysBefore(today, i) })),
      ...Array.from({ length: 30 }, (_, i) => ({ userId: 'u2', date: dateNDaysBefore(today, i) })),
      { userId: 'u3', date: dateNDaysBefore(today, 5) },
    ];
    expect(calculateContinuousUsers(events, today)).toEqual({ days90: 1, days60: 1, days30: 2 });
  });
});

describe('calculateAvgDailyActiveUsers', () => {
  const today = '2026-07-19';

  it('returns 0 when there are no events', () => {
    expect(calculateAvgDailyActiveUsers([], today)).toBe(0);
  });

  it('averages distinct daily users over the full 30-day window, including zero-activity days', () => {
    const events = [
      { userId: 'u1', date: dateNDaysBefore(today, 0) },
      { userId: 'u2', date: dateNDaysBefore(today, 0) },
    ];
    expect(calculateAvgDailyActiveUsers(events, today)).toBe(0.1);
  });

  it('does not double-count the same user active multiple times in one day', () => {
    const events = [
      { userId: 'u1', date: dateNDaysBefore(today, 0) },
      { userId: 'u1', date: dateNDaysBefore(today, 0) },
    ];
    expect(calculateAvgDailyActiveUsers(events, today)).toBe(Math.round((1 / 30) * 10) / 10);
  });
});

describe('calculateTopFeatures', () => {
  it('returns an empty array when there are no events', () => {
    expect(calculateTopFeatures([])).toEqual([]);
  });

  it('ranks screens by descending count', () => {
    const events = [
      { screen: 'Home' },
      { screen: 'Home' },
      { screen: 'Home' },
      { screen: 'Trends' },
      { screen: 'Trends' },
      { screen: 'DailyRecord' },
    ];
    expect(calculateTopFeatures(events)).toEqual([
      { screen: 'Home', count: 3 },
      { screen: 'Trends', count: 2 },
      { screen: 'DailyRecord', count: 1 },
    ]);
  });

  it('limits results to the given limit', () => {
    const events = Array.from({ length: 15 }, (_, i) => ({ screen: `Screen${i}` }));
    expect(calculateTopFeatures(events, 10)).toHaveLength(10);
  });
});
