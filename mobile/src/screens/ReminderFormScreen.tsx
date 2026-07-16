import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { createReminder, updateReminder, getReminders, Reminder } from '../api/reminders';
import { requestNotificationPermission, scheduleReminderNotifications } from '../utils/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderForm'>;

const TYPES: { value: Reminder['type']; label: string }[] = [
  { value: 'blood_pressure', label: '测血压' },
  { value: 'medication', label: '吃药' },
  { value: 'exercise', label: '运动' },
  { value: 'blood_glucose', label: '测血糖' },
  { value: 'custom', label: '自定义' },
];

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function ReminderFormScreen({ navigation, route }: Props) {
  const reminderId = route.params.reminderId;
  const [type, setType] = useState<Reminder['type']>('blood_pressure');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loading, setLoading] = useState(!!reminderId);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!reminderId) return;
    getReminders()
      .then((reminders) => {
        const existing = reminders.find((r) => r.id === reminderId);
        if (existing) {
          setType(existing.type);
          setTitle(existing.title);
          setTime(existing.time);
          setWeekdays(existing.weekdays);
        }
      })
      .catch(() => Alert.alert('加载失败', '请稍后重试'))
      .finally(() => setLoading(false));
  }, [reminderId]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSubmit() {
    if (type === 'custom' && title.trim() === '') {
      Alert.alert('请完整填写', '自定义提醒需要填写标题');
      return;
    }
    if (!TIME_RE.test(time)) {
      Alert.alert('时间格式不对', '请填写 HH:mm 格式，例如 09:00');
      return;
    }
    if (weekdays.length === 0) {
      Alert.alert('请选择重复日期', '至少选择一个星期几');
      return;
    }

    setSubmitting(true);
    try {
      await requestNotificationPermission();
      const input = { type, title, time, weekdays };
      const saved = reminderId ? await updateReminder(reminderId, input) : await createReminder(input);
      await scheduleReminderNotifications(saved);
      navigation.goBack();
    } catch (err) {
      Alert.alert('保存失败', '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{reminderId ? '编辑提醒' : '新建提醒'}</Text>

      <Text style={styles.label}>类型</Text>
      <View style={styles.chipRow}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.chip, type === t.value && styles.chipSelected]}
            onPress={() => setType(t.value)}
          >
            <Text style={[styles.chipText, type === t.value && styles.chipTextSelected]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {type === 'custom' && <TextInput style={styles.input} placeholder="提醒标题" value={title} onChangeText={setTitle} />}

      <Text style={styles.label}>时间 (HH:mm)</Text>
      <TextInput style={styles.input} placeholder="09:00" value={time} onChangeText={setTime} />

      <Text style={styles.label}>重复</Text>
      <View style={styles.chipRow}>
        {WEEKDAYS.map((w) => (
          <TouchableOpacity
            key={w.value}
            style={[styles.chip, weekdays.includes(w.value) && styles.chipSelected]}
            onPress={() => toggleWeekday(w.value)}
          >
            <Text style={[styles.chipText, weekdays.includes(w.value) && styles.chipTextSelected]}>{w.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title={submitting ? '保存中...' : '保存'} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  label: { fontWeight: '600', marginBottom: 8, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff' },
});
