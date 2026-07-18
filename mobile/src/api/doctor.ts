import { apiClient } from './client';
import { todayLocalDate } from '../utils/date';

export interface PatientSummary {
  id: string;
  name: string;
  age: number | null;
  chronicConditions: string[];
}

export interface PatientProfile {
  id: string;
  userId: string;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  chronicConditions: string[];
  medications: string[];
  allergies: string | null;
  bmi: number;
}

export interface PatientRecord {
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

export interface PatientAdherence {
  completedDays: number;
  missedDays: number;
  completionRate: number;
  currentStreak: number;
}

export async function getPatients(condition?: string): Promise<PatientSummary[]> {
  const res = await apiClient.get<PatientSummary[]>('/doctor/patients', {
    params: condition ? { condition } : undefined,
  });
  return res.data;
}

export async function getPatientProfile(patientId: string): Promise<PatientProfile> {
  const res = await apiClient.get<PatientProfile>(`/doctor/patients/${patientId}/profile`);
  return res.data;
}

export async function getPatientRecords(patientId: string, days = 90): Promise<PatientRecord[]> {
  const res = await apiClient.get<PatientRecord[]>(`/doctor/patients/${patientId}/records`, { params: { days } });
  return res.data;
}

export async function getPatientAdherence(patientId: string): Promise<PatientAdherence> {
  const res = await apiClient.get<PatientAdherence>(`/doctor/patients/${patientId}/adherence`, {
    params: { today: todayLocalDate() },
  });
  return res.data;
}
