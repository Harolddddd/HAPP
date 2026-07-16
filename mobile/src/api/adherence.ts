import { apiClient } from './client';
import { todayLocalDate } from '../utils/date';

export interface AdherenceResult {
  completedDays: number;
  missedDays: number;
  completionRate: number;
  currentStreak: number;
}

export async function getAdherence(): Promise<AdherenceResult> {
  const res = await apiClient.get<AdherenceResult>('/adherence', { params: { today: todayLocalDate() } });
  return res.data;
}
