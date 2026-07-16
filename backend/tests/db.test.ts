import { prisma } from '../src/db';

describe('prisma client', () => {
  it('exposes model delegates for User, HealthProfile, DailyRecord, Reminder', () => {
    expect(typeof prisma.user.create).toBe('function');
    expect(typeof prisma.healthProfile.upsert).toBe('function');
    expect(typeof prisma.dailyRecord.upsert).toBe('function');
    expect(typeof prisma.reminder.create).toBe('function');
  });
});
