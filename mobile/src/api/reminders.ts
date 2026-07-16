import { apiClient } from './client';

export interface Reminder {
  id: string;
  userId: string;
  type: 'blood_pressure' | 'medication' | 'exercise' | 'blood_glucose' | 'custom';
  title: string;
  time: string;
  weekdays: number[];
  enabled: boolean;
}

export type ReminderInput = {
  type: Reminder['type'];
  title: string;
  time: string;
  weekdays: number[];
};

export async function getReminders(): Promise<Reminder[]> {
  const res = await apiClient.get<Reminder[]>('/reminders');
  return res.data;
}

export async function createReminder(input: ReminderInput): Promise<Reminder> {
  const res = await apiClient.post<Reminder>('/reminders', input);
  return res.data;
}

export async function updateReminder(
  id: string,
  input: Partial<ReminderInput> & { enabled?: boolean }
): Promise<Reminder> {
  const res = await apiClient.put<Reminder>(`/reminders/${id}`, input);
  return res.data;
}

export async function deleteReminder(id: string): Promise<void> {
  await apiClient.delete(`/reminders/${id}`);
}
