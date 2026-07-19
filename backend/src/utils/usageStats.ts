export interface ContinuousUsersResult {
  days90: number;
  days60: number;
  days30: number;
}

export interface TopFeature {
  screen: string;
  count: number;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function calculateStreak(activeDays: Set<string>, todayKey: string): number {
  let streak = 0;
  let offset = activeDays.has(todayKey) ? 0 : 1;
  while (activeDays.has(addDays(todayKey, -offset))) {
    streak++;
    offset++;
  }
  return streak;
}

export function calculateContinuousUsers(
  events: { userId: string; date: Date }[],
  todayKey: string
): ContinuousUsersResult {
  const byUser = new Map<string, Set<string>>();
  for (const e of events) {
    const key = toDateKey(e.date);
    if (!byUser.has(e.userId)) byUser.set(e.userId, new Set());
    byUser.get(e.userId)!.add(key);
  }

  let days90 = 0;
  let days60 = 0;
  let days30 = 0;

  for (const activeDays of byUser.values()) {
    const streak = calculateStreak(activeDays, todayKey);
    if (streak >= 90) days90++;
    if (streak >= 60) days60++;
    if (streak >= 30) days30++;
  }

  return { days90, days60, days30 };
}

export function calculateAvgDailyActiveUsers(events: { userId: string; date: Date }[], todayKey: string): number {
  const byDay = new Map<string, Set<string>>();
  for (let i = 0; i < 30; i++) {
    byDay.set(addDays(todayKey, -i), new Set());
  }

  for (const e of events) {
    const key = toDateKey(e.date);
    const set = byDay.get(key);
    if (set) set.add(e.userId);
  }

  let total = 0;
  for (const set of byDay.values()) {
    total += set.size;
  }

  return Math.round((total / 30) * 10) / 10;
}

export function calculateTopFeatures(events: { screen: string }[], limit = 10): TopFeature[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    counts.set(e.screen, (counts.get(e.screen) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([screen, count]) => ({ screen, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
