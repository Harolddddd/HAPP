import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getAdherence, AdherenceResult } from '../api/adherence';

export default function AdherenceScreen() {
  const [result, setResult] = useState<AdherenceResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdherence()
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>加载失败，请稍后重试</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.bigNumber}>{Math.round(result.completionRate * 100)}%</Text>
        <Text style={styles.label}>最近30天完成率</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{result.currentStreak}</Text>
          <Text style={styles.label}>连续记录天数</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{result.missedDays}</Text>
          <Text style={styles.label}>漏记天数</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { alignItems: 'center', marginBottom: 32 },
  bigNumber: { fontSize: 48, fontWeight: 'bold', color: '#3498db' },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 32, fontWeight: 'bold' },
  label: { color: '#666', marginTop: 4 },
  empty: { color: '#888' },
});
