import { validateDailyRecord, hasAnyDailyRecordField } from '../src/utils/validators';

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
        measuredHour: 8,
      })
    ).toEqual([]);
  });

  it('flags systolic out of range', () => {
    const errors = validateDailyRecord({ systolic: 300 });
    expect(errors).toContainEqual({ field: 'systolic', message: '收缩压需在50-250之间' });
  });

  it('flags measuredHour out of range', () => {
    const errors = validateDailyRecord({ measuredHour: 24 });
    expect(errors).toContainEqual({ field: 'measuredHour', message: '测量时间需为0-23时' });
  });

  it('accepts measuredHour at the boundaries', () => {
    expect(validateDailyRecord({ measuredHour: 0 })).toEqual([]);
    expect(validateDailyRecord({ measuredHour: 23 })).toEqual([]);
  });

  it('can flag multiple fields at once', () => {
    const errors = validateDailyRecord({ systolic: 300, heartRate: 10 });
    expect(errors.map((e) => e.field).sort()).toEqual(['heartRate', 'systolic']);
  });
});

describe('hasAnyDailyRecordField', () => {
  it('returns false when every field is omitted', () => {
    expect(hasAnyDailyRecordField({})).toBe(false);
  });

  it('returns true when only measuredHour is set, including hour 0', () => {
    expect(hasAnyDailyRecordField({ measuredHour: 0 })).toBe(true);
  });

  it('returns true when any other single field is set', () => {
    expect(hasAnyDailyRecordField({ waterMl: 200 })).toBe(true);
  });
});
