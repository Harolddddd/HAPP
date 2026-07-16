export interface AdherenceResult {
  completedDays: number;
  missedDays: number;
  completionRate: number;
  currentStreak: number;
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

export function calculateAdherence(recordDates: Date[], todayKey: string): AdherenceResult {
  const recordedDays = new Set(recordDates.map(toDateKey));

  let completedDays = 0;
  for (let i = 0; i < 30; i++) {
    if (recordedDays.has(addDays(todayKey, -i))) completedDays++;
  }
  const missedDays = 30 - completedDays;
  const completionRate = Math.round((completedDays / 30) * 100) / 100;

  let currentStreak = 0;
  let offset = recordedDays.has(todayKey) ? 0 : 1;
  while (recordedDays.has(addDays(todayKey, -offset))) {
    currentStreak++;
    offset++;
  }

  return { completedDays, missedDays, completionRate, currentStreak };
}
