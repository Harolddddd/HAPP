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

  it('flags measuredHour out of range', () => {
    expect(validateDailyRecord({ measuredHour: 24 })).toContain('measuredHour must be between 0 and 23');
  });

  it('accepts measuredHour at the boundaries', () => {
    expect(validateDailyRecord({ measuredHour: 0 })).toEqual([]);
    expect(validateDailyRecord({ measuredHour: 23 })).toEqual([]);
  });
});

describe('hasAnyDailyRecordField', () => {
  it('returns false when every field is omitted', () => {
    expect(hasAnyDailyRecordField({})).toBe(false);
  });

  it('returns false when every field is explicitly null or undefined', () => {
    expect(hasAnyDailyRecordField({ systolic: undefined, diastolic: undefined })).toBe(false);
  });

  it('returns true when only measuredHour is set', () => {
    expect(hasAnyDailyRecordField({ measuredHour: 0 })).toBe(true);
  });

  it('returns true when any other single field is set', () => {
    expect(hasAnyDailyRecordField({ waterMl: 200 })).toBe(true);
  });
});
