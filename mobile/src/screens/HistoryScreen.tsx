import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getRecords, DailyRecord } from '../api/records';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

function HistoryRow({ item, onEdit }: { item: DailyRecord; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    Animated.spring(scale, { toValue: next ? 1.03 : 1, useNativeDriver: true, friction: 6 }).start();
  }

  return (
    <Animated.View style={[styles.row, expanded && styles.rowExpanded, { transform: [{ scale }] }]}>
      <Pressable onPress={toggle}>
        <View style={styles.rowHeader}>
          <Text style={styles.date}>
            {item.recordDate.slice(0, 10)}
            {item.measuredHour != null ? `  ${item.measuredHour}时` : ''}
          </Text>
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Text style={styles.editText}>编辑</Text>
          </TouchableOpacity>
        </View>
        <Text>
          血压: {item.systolic ?? '-'}/{item.diastolic ?? '-'}　血糖: {item.bloodGlucose ?? '-'}
        </Text>
        <Text>
          心率: {item.heartRate ?? '-'}　体重: {item.weightKg ?? '-'}kg
        </Text>
        <Text>
          睡眠: {item.sleepHours ?? '-'}h　运动: {item.exerciseMinutes ?? '-'}min　饮水: {item.waterMl ?? '-'}ml
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function HistoryScreen({ navigation }: Props) {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecords(30)
      .then((data) => {
        setRecords([...data].reverse());
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>暂无记录</Text>}
      renderItem={({ item }) => (
        <HistoryRow item={item} onEdit={() => navigation.navigate('DailyRecord', { record: item })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  row: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  rowExpanded: { backgroundColor: '#f5f9fc', borderColor: '#3498db' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  date: { fontWeight: 'bold' },
  editButton: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#3498db' },
  editText: { color: '#3498db', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
