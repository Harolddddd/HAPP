import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Switch, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getReminders, updateReminder, deleteReminder, Reminder } from '../api/reminders';
import { scheduleReminderNotifications, cancelReminderNotifications } from '../utils/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Reminders'>;

const TYPE_LABELS: Record<string, string> = {
  blood_pressure: '测血压',
  medication: '吃药',
  exercise: '运动',
  blood_glucose: '测血糖',
  custom: '自定义',
};

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function labelFor(reminder: Reminder): string {
  return reminder.type === 'custom' ? reminder.title : TYPE_LABELS[reminder.type];
}

export default function RemindersScreen({ navigation }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getReminders()
      .then(setReminders)
      .catch(() => Alert.alert('加载失败', '请稍后重试'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggle(reminder: Reminder, enabled: boolean) {
    try {
      const updated = await updateReminder(reminder.id, { enabled });
      setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (enabled) {
        await scheduleReminderNotifications(updated);
      } else {
        await cancelReminderNotifications(updated.id);
      }
    } catch {
      Alert.alert('更新失败', '请稍后重试');
    }
  }

  function handleDelete(reminder: Reminder) {
    Alert.alert('删除提醒', `确定删除"${labelFor(reminder)}"吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(reminder.id);
            await cancelReminderNotifications(reminder.id);
            setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
          } catch {
            Alert.alert('删除失败', '请稍后重试');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>还没有提醒，点下面按钮新建一个</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{labelFor(item)}</Text>
              <Text style={styles.rowSubtitle}>
                {item.time} · {item.weekdays.map((w) => WEEKDAY_LABELS[w]).join('、')}
              </Text>
            </View>
            <Switch value={item.enabled} onValueChange={(v) => handleToggle(item, v)} />
            <Button title="编辑" onPress={() => navigation.navigate('ReminderForm', { reminderId: item.id })} />
            <Button title="删除" color="#c0392b" onPress={() => handleDelete(item)} />
          </View>
        )}
      />
      <Button title="新建提醒" onPress={() => navigation.navigate('ReminderForm', {})} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 12,
    gap: 8,
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontWeight: 'bold', fontSize: 16 },
  rowSubtitle: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
