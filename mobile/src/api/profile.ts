import { apiClient } from './client';

export interface HealthProfile {
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

export async function getProfile(): Promise<HealthProfile | null> {
  try {
    const res = await apiClient.get<HealthProfile>('/profile');
    return res.data;
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export async function saveProfile(input: {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  chronicConditions: string[];
  medications: string[];
  allergies: string;
}): Promise<HealthProfile> {
  const res = await apiClient.put<HealthProfile>('/profile', input);
  return res.data;
}
