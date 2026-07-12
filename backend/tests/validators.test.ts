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

  it('returns no errors when all fields are omitted', () => {
    expect(validateDailyRecord({})).toEqual([]);
  });

  it('flags systolic out of range', () => {
    expect(validateDailyRecord({ systolic: 300 })).toContain('systolic must be between 50 and 250');
  });

  it('flags heartRate out of range', () => {
    expect(validateDailyRecord({ heartRate: 10 })).toContain('heartRate must be between 30 and 220');
  });

  it('flags sleepHours out of range', () => {
    expect(validateDailyRecord({ sleepHours: 30 })).toContain('sleepHours must be between 0 and 24');
  });
});
