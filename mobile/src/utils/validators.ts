export interface DailyRecordInput {
  systolic?: number;
  diastolic?: number;
  bloodGlucose?: number;
  heartRate?: number;
  weightKg?: number;
  sleepHours?: number;
  exerciseMinutes?: number;
  waterMl?: number;
  measuredHour?: number;
}

export interface FieldError {
  field: keyof DailyRecordInput;
  message: string;
}

export function validateDailyRecord(input: DailyRecordInput): FieldError[] {
  const errors: FieldError[] = [];

  if (input.systolic !== undefined && (input.systolic < 50 || input.systolic > 250)) {
    errors.push({ field: 'systolic', message: '收缩压需在50-250之间' });
  }
  if (input.diastolic !== undefined && (input.diastolic < 30 || input.diastolic > 150)) {
    errors.push({ field: 'diastolic', message: '舒张压需在30-150之间' });
  }
  if (input.bloodGlucose !== undefined && (input.bloodGlucose < 1 || input.bloodGlucose > 40)) {
    errors.push({ field: 'bloodGlucose', message: '血糖需在1-40 mmol/L之间' });
  }
  if (input.heartRate !== undefined && (input.heartRate < 30 || input.heartRate > 220)) {
    errors.push({ field: 'heartRate', message: '心率需在30-220之间' });
  }
  if (input.weightKg !== undefined && (input.weightKg < 20 || input.weightKg > 300)) {
    errors.push({ field: 'weightKg', message: '体重需在20-300kg之间' });
  }
  if (input.sleepHours !== undefined && (input.sleepHours < 0 || input.sleepHours > 24)) {
    errors.push({ field: 'sleepHours', message: '睡眠时长需在0-24小时之间' });
  }
  if (input.exerciseMinutes !== undefined && (input.exerciseMinutes < 0 || input.exerciseMinutes > 1440)) {
    errors.push({ field: 'exerciseMinutes', message: '运动时长需在0-1440分钟之间' });
  }
  if (input.waterMl !== undefined && (input.waterMl < 0 || input.waterMl > 10000)) {
    errors.push({ field: 'waterMl', message: '饮水量需在0-10000ml之间' });
  }
  if (input.measuredHour !== undefined && (input.measuredHour < 0 || input.measuredHour > 23)) {
    errors.push({ field: 'measuredHour', message: '测量时间需为0-23时' });
  }

  return errors;
}
