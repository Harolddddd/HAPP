import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getRecords, DailyRecord } from '../api/records';

type Metric = 'bloodPressure' | 'bloodGlucose' | 'weightKg';

export default function TrendsScreen() {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('bloodPressure');

  useEffect(() => {
    getRecords(30)
      .then((data) => {
        setRecords(data);
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

  const filteredRecords =
    metric === 'bloodPressure'
      ? records.filter((r) => r.systolic != null && r.diastolic != null)
      : metric === 'bloodGlucose'
      ? records.filter((r) => r.bloodGlucose != null)
      : records.filter((r) => r.weightKg != null);

  const labels = filteredRecords.map((r) => r.recordDate.slice(5, 10));

  const datasets =
    metric === 'bloodPressure'
      ? [
          { data: filteredRecords.map((r) => r.systolic ?? 0), color: () => '#e74c3c' },
          { data: filteredRecords.map((r) => r.diastolic ?? 0), color: () => '#3498db' },
        ]
      : metric === 'bloodGlucose'
      ? [{ data: filteredRecords.map((r) => r.bloodGlucose ?? 0), color: () => '#2ecc71' }]
      : [{ data: filteredRecords.map((r) => r.weightKg ?? 0), color: () => '#9b59b6' }];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>30天趋势图</Text>
      <View style={styles.buttons}>
        <Button title="血压" onPress={() => setMetric('bloodPressure')} />
        <Button title="血糖" onPress={() => setMetric('bloodGlucose')} />
        <Button title="体重" onPress={() => setMetric('weightKg')} />
      </View>
      {filteredRecords.length === 0 ? (
        <Text style={styles.empty}>暂无数据</Text>
      ) : (
        <LineChart
          data={{ labels, datasets }}
          width={Dimensions.get('window').width - 32}
          height={240}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 1,
            color: () => '#333',
            labelColor: () => '#333',
          }}
          bezier
          style={{ borderRadius: 8 }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
