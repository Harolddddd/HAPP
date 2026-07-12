export interface DailyRecordInput {
  systolic?: number;
  diastolic?: number;
  bloodGlucose?: number;
  heartRate?: number;
  weightKg?: number;
  sleepHours?: number;
  exerciseMinutes?: number;
  waterMl?: number;
}

export function validateDailyRecord(input: DailyRecordInput): string[] {
  const errors: string[] = [];

  if (input.systolic !== undefined && (input.systolic < 50 || input.systolic > 250)) {
    errors.push('systolic must be between 50 and 250');
  }
  if (input.diastolic !== undefined && (input.diastolic < 30 || input.diastolic > 150)) {
    errors.push('diastolic must be between 30 and 150');
  }
  if (input.bloodGlucose !== undefined && (input.bloodGlucose < 1 || input.bloodGlucose > 40)) {
    errors.push('bloodGlucose must be between 1 and 40 mmol/L');
  }
  if (input.heartRate !== undefined && (input.heartRate < 30 || input.heartRate > 220)) {
    errors.push('heartRate must be between 30 and 220');
  }
  if (input.weightKg !== undefined && (input.weightKg < 20 || input.weightKg > 300)) {
    errors.push('weightKg must be between 20 and 300');
  }
  if (input.sleepHours !== undefined && (input.sleepHours < 0 || input.sleepHours > 24)) {
    errors.push('sleepHours must be between 0 and 24');
  }
  if (input.exerciseMinutes !== undefined && (input.exerciseMinutes < 0 || input.exerciseMinutes > 1440)) {
    errors.push('exerciseMinutes must be between 0 and 1440');
  }
  if (input.waterMl !== undefined && (input.waterMl < 0 || input.waterMl > 10000)) {
    errors.push('waterMl must be between 0 and 10000');
  }

  return errors;
}
