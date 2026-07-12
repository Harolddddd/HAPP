import { apiClient } from './client';

export interface DailyRecord {
  id: string;
  userId: string;
  recordDate: string;
  systolic: number | null;
  diastolic: number | null;
  bloodGlucose: number | null;
  heartRate: number | null;
  weightKg: number | null;
  sleepHours: number | null;
  exerciseMinutes: number | null;
  waterMl: number | null;
}

export type DailyRecordInput = Partial<
  Pick<
    DailyRecord,
    'systolic' | 'diastolic' | 'bloodGlucose' | 'heartRate' | 'weightKg' | 'sleepHours' | 'exerciseMinutes' | 'waterMl'
  >
> & { recordDate: string };

export async function saveDailyRecord(input: DailyRecordInput): Promise<DailyRecord> {
  const res = await apiClient.post<DailyRecord>('/records', input);
  return res.data;
}

export async function getRecords(days = 30): Promise<DailyRecord[]> {
  const res = await apiClient.get<DailyRecord[]>('/records', { params: { days } });
  return res.data;
}
