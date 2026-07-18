import { apiClient } from './client';

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string; role: string };
}

export type UserRole = 'patient' | 'doctor';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function register(
  email: string,
  password: string,
  name: string,
  role: UserRole = 'patient'
): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/register', { email, password, name, role });
  return res.data;
}

export async function getMe(): Promise<AuthResponse['user']> {
  const res = await apiClient.get<AuthResponse['user']>('/auth/me');
  return res.data;
}
