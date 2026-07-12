import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { getRecords, DailyRecord } from '../api/records';

export default function HistoryScreen() {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecords(30).then((data) => {
      setRecords([...data].reverse());
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
        <View style={styles.row}>
          <Text style={styles.date}>{item.recordDate.slice(0, 10)}</Text>
          <Text>血压: {item.systolic ?? '-'}/{item.diastolic ?? '-'}　血糖: {item.bloodGlucose ?? '-'}</Text>
          <Text>心率: {item.heartRate ?? '-'}　体重: {item.weightKg ?? '-'}kg</Text>
          <Text>睡眠: {item.sleepHours ?? '-'}h　运动: {item.exerciseMinutes ?? '-'}min　饮水: {item.waterMl ?? '-'}ml</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  row: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12 },
  date: { fontWeight: 'bold', marginBottom: 4 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
