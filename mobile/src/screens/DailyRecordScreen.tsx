import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { saveDailyRecord } from '../api/records';
import { validateDailyRecord } from '../utils/validators';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyRecord'>;

function toNumberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export default function DailyRecordScreen({ navigation }: Props) {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [bloodGlucose, setBloodGlucose] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [exerciseMinutes, setExerciseMinutes] = useState('');
  const [waterMl, setWaterMl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const input = {
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
      Alert.alert('请检查填写内容', errors.join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      const recordDate = new Date().toISOString().slice(0, 10);
      await saveDailyRecord({ recordDate, ...input });
      navigation.goBack();
    } catch (err) {
      Alert.alert('保存失败', '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>今日记录</Text>
      <TextInput style={styles.input} placeholder="收缩压" keyboardType="numeric" value={systolic} onChangeText={setSystolic} />
      <TextInput style={styles.input} placeholder="舒张压" keyboardType="numeric" value={diastolic} onChangeText={setDiastolic} />
      <TextInput style={styles.input} placeholder="血糖 (mmol/L)" keyboardType="numeric" value={bloodGlucose} onChangeText={setBloodGlucose} />
      <TextInput style={styles.input} placeholder="心率" keyboardType="numeric" value={heartRate} onChangeText={setHeartRate} />
      <TextInput style={styles.input} placeholder="体重 (kg)" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />
      <TextInput style={styles.input} placeholder="睡眠时长 (小时)" keyboardType="numeric" value={sleepHours} onChangeText={setSleepHours} />
      <TextInput style={styles.input} placeholder="运动时长 (分钟)" keyboardType="numeric" value={exerciseMinutes} onChangeText={setExerciseMinutes} />
      <TextInput style={styles.input} placeholder="饮水量 (ml)" keyboardType="numeric" value={waterMl} onChangeText={setWaterMl} />
      <Button title={submitting ? '保存中...' : '保存'} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
});
