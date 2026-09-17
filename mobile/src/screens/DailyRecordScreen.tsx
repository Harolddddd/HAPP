import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { saveDailyRecord } from '../api/records';
import { validateDailyRecord, FieldError } from '../utils/validators';
import { todayLocalDate } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyRecord'>;

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function toNumberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export default function DailyRecordScreen({ navigation, route }: Props) {
  const editingRecord = route.params?.record;

  const [measuredHour, setMeasuredHour] = useState<number | undefined>(editingRecord?.measuredHour ?? undefined);
  const [systolic, setSystolic] = useState(editingRecord?.systolic != null ? String(editingRecord.systolic) : '');
  const [diastolic, setDiastolic] = useState(editingRecord?.diastolic != null ? String(editingRecord.diastolic) : '');
  const [bloodGlucose, setBloodGlucose] = useState(
    editingRecord?.bloodGlucose != null ? String(editingRecord.bloodGlucose) : ''
  );
  const [heartRate, setHeartRate] = useState(editingRecord?.heartRate != null ? String(editingRecord.heartRate) : '');
  const [weightKg, setWeightKg] = useState(editingRecord?.weightKg != null ? String(editingRecord.weightKg) : '');
  const [sleepHours, setSleepHours] = useState(
    editingRecord?.sleepHours != null ? String(editingRecord.sleepHours) : ''
  );
  const [exerciseMinutes, setExerciseMinutes] = useState(
    editingRecord?.exerciseMinutes != null ? String(editingRecord.exerciseMinutes) : ''
  );
  const [waterMl, setWaterMl] = useState(editingRecord?.waterMl != null ? String(editingRecord.waterMl) : '');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldError['field'], string>>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const input = {
      measuredHour,
      systolic: toNumberOrUndefined(systolic),
      diastolic: toNumberOrUndefined(diastolic),
      bloodGlucose: toNumberOrUndefined(bloodGlucose),
      heartRate: toNumberOrUndefined(heartRate),
      weightKg: toNumberOrUndefined(weightKg),
      sleepHours: toNumberOrUndefined(sleepHours),
      exerciseMinutes: toNumberOrUndefined(exerciseMinutes),
      waterMl: toNumberOrUndefined(waterMl),
    };

    const errors = validateDailyRecord(input);
    if (errors.length > 0) {
      const errorMap: Partial<Record<FieldError['field'], string>> = {};
      errors.forEach((e) => {
        errorMap[e.field] = e.message;
      });
      setFieldErrors(errorMap);
      setError('部分内容填写有误，请检查下方标红的字段');
      return;
    }

    setFieldErrors({});
    setError(null);
    setSubmitting(true);
    try {
      const recordDate = editingRecord ? editingRecord.recordDate.slice(0, 10) : todayLocalDate();
      await saveDailyRecord({ recordDate, ...input });
      navigation.goBack();
    } catch (err) {
      setError('保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  function fieldStyle(field: FieldError['field']) {
    return [styles.input, fieldErrors[field] && styles.inputError];
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{editingRecord ? '编辑记录' : '今日记录'}</Text>

      <Text style={styles.label}>测量时间</Text>
      <View style={styles.chipRow}>
        {HOURS.map((h) => (
          <TouchableOpacity
            key={h}
            style={[styles.hourChip, measuredHour === h && styles.chipSelected]}
            onPress={() => setMeasuredHour(measuredHour === h ? undefined : h)}
          >
            <Text style={[styles.chipText, measuredHour === h && styles.chipTextSelected]}>{h}时</Text>
          </TouchableOpacity>
        ))}
      </View>
      {fieldErrors.measuredHour && <Text style={styles.fieldError}>{fieldErrors.measuredHour}</Text>}

      <TextInput
        style={fieldStyle('systolic')}
        placeholder="收缩压"
        keyboardType="numeric"
        value={systolic}
        onChangeText={setSystolic}
      />
      {fieldErrors.systolic && <Text style={styles.fieldError}>{fieldErrors.systolic}</Text>}

      <TextInput
        style={fieldStyle('diastolic')}
        placeholder="舒张压"
        keyboardType="numeric"
        value={diastolic}
        onChangeText={setDiastolic}
      />
      {fieldErrors.diastolic && <Text style={styles.fieldError}>{fieldErrors.diastolic}</Text>}

      <TextInput
        style={fieldStyle('bloodGlucose')}
        placeholder="血糖 (mmol/L)"
        keyboardType="numeric"
        value={bloodGlucose}
        onChangeText={setBloodGlucose}
      />
      {fieldErrors.bloodGlucose && <Text style={styles.fieldError}>{fieldErrors.bloodGlucose}</Text>}

      <TextInput
        style={fieldStyle('heartRate')}
        placeholder="心率"
        keyboardType="numeric"
        value={heartRate}
        onChangeText={setHeartRate}
      />
      {fieldErrors.heartRate && <Text style={styles.fieldError}>{fieldErrors.heartRate}</Text>}

      <TextInput
        style={fieldStyle('weightKg')}
        placeholder="体重 (kg)"
        keyboardType="numeric"
        value={weightKg}
        onChangeText={setWeightKg}
      />
      {fieldErrors.weightKg && <Text style={styles.fieldError}>{fieldErrors.weightKg}</Text>}

      <TextInput
        style={fieldStyle('sleepHours')}
        placeholder="睡眠时长 (小时)"
        keyboardType="numeric"
        value={sleepHours}
        onChangeText={setSleepHours}
      />
      {fieldErrors.sleepHours && <Text style={styles.fieldError}>{fieldErrors.sleepHours}</Text>}

      <TextInput
        style={fieldStyle('exerciseMinutes')}
        placeholder="运动时长 (分钟)"
        keyboardType="numeric"
        value={exerciseMinutes}
        onChangeText={setExerciseMinutes}
      />
      {fieldErrors.exerciseMinutes && <Text style={styles.fieldError}>{fieldErrors.exerciseMinutes}</Text>}

      <TextInput
        style={fieldStyle('waterMl')}
        placeholder="饮水量 (ml)"
        keyboardType="numeric"
        value={waterMl}
        onChangeText={setWaterMl}
      />
      {fieldErrors.waterMl && <Text style={styles.fieldError}>{fieldErrors.waterMl}</Text>}

      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={submitting ? '保存中...' : '保存'} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  label: { fontSize: 14, color: '#555', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 4 },
  inputError: { borderColor: '#e74c3c' },
  fieldError: { color: '#e74c3c', fontSize: 12, marginBottom: 8 },
  error: { color: '#e74c3c', marginBottom: 12, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  hourChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14 },
  chipSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff' },
});
