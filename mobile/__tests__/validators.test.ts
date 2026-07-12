import { validateDailyRecord } from '../src/utils/validators';

describe('validateDailyRecord', () => {
  it('returns no errors for a fully valid record', () => {
    expect(
      validateDailyRecord({
        systolic: 120,
        diastolic: 80,
        bloodGlucose: 5.5,
        heartRate: 70,
        weightKg: 65,
        sleepHours: 8,
        exerciseMinutes: 30,
        waterMl: 2000,
      })
    ).toEqual([]);
  });

  it('flags systolic out of range', () => {
    expect(validateDailyRecord({ systolic: 300 })).toContain('systolic must be between 50 and 250');
  });
});
