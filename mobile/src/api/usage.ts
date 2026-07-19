import { apiClient } from './client';

export async function logUsageEvent(screen: string): Promise<void> {
  try {
    await apiClient.post('/usage-events', { screen });
  } catch {
    // best-effort analytics ping; never block or surface errors to the user
  }
}
