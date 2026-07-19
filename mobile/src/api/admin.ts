import { apiClient } from './client';

export interface ContinuousUsers {
  days90: number;
  days60: number;
  days30: number;
}

export interface TopFeature {
  screen: string;
  count: number;
}

export interface AdminStats {
  continuousUsers: ContinuousUsers;
  avgDailyActiveUsers: number;
  topFeatures: TopFeature[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await apiClient.get<AdminStats>('/admin/stats');
  return res.data;
}
