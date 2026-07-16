import { calculateAdherence } from '../src/utils/adherence';

function dateNDaysBefore(base: string, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('calculateAdherence', () => {
  const today = '2026-07-13';

  it('returns all zeros when there are no records', () => {
    expect(calculateAdherence([], today)).toEqual({
      completedDays: 0,
      missedDays: 30,
      completionRate: 0,
      currentStreak: 0,
    });
  });

  it('counts a full 30-day streak when every day in the window is recorded', () => {
    const dates = Array.from({ length: 30 }, (_, i) => dateNDaysBefore(today, i));
    const result = calculateAdherence(dates, today);
    expect(result.completedDays).toBe(30);
    expect(result.missedDays).toBe(0);
    expect(result.completionRate).toBe(1);
    expect(result.currentStreak).toBe(30);
  });

  it('continues the streak from yesterday when today has no record yet', () => {
    const dates = [dateNDaysBefore(today, 1), dateNDaysBefore(today, 2), dateNDaysBefore(today, 3)];
    const result = calculateAdherence(dates, today);
    expect(result.currentStreak).toBe(3);
    expect(result.completedDays).toBe(3);
  });

  it('resets the streak to 0 when both today and yesterday are missing', () => {
    const dates = [dateNDaysBefore(today, 2), dateNDaysBefore(today, 3)];
    const result = calculateAdherence(dates, today);
    expect(result.currentStreak).toBe(0);
    expect(result.completedDays).toBe(2);
  });

  it('stops the streak at the first gap', () => {
    const dates = [dateNDaysBefore(today, 0), dateNDaysBefore(today, 1), dateNDaysBefore(today, 3)];
    const result = calculateAdherence(dates, today);
    expect(result.currentStreak).toBe(2);
    expect(result.completedDays).toBe(3);
  });
});
