import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Button } from 'react-native';
import { getAdminStats, AdminStats } from '../api/admin';
import { useAuth } from '../context/AuthContext';

const SCREEN_LABELS: Record<string, string> = {
  Home: '首页',
  ProfileSetup: '健康档案',
  DailyRecord: '今日记录',
  History: '历史记录',
  Trends: '趋势图',
  Reminders: '健康提醒',
  ReminderForm: '编辑提醒',
  Adherence: '依从性分析',
  DoctorPatientList: '患者列表',
  DoctorPatientDetail: '患者详情',
  AdminStats: '后台统计',
};

function labelFor(screen: string): string {
  return SCREEN_LABELS[screen] ?? screen;
}

export default function AdminStatsScreen() {
  const { logout } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  function loadStats() {
    setLoading(true);
    getAdminStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>加载失败，请稍后重试</Text>
        <Button title="重试" onPress={loadStats} />
        <Button title="退出登录" color="#c0392b" onPress={() => logout()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>连续使用人数</Text>
        <View style={styles.row}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.continuousUsers.days90}</Text>
            <Text style={styles.label}>≥90天</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.continuousUsers.days60}</Text>
            <Text style={styles.label}>≥60天</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.continuousUsers.days30}</Text>
            <Text style={styles.label}>≥30天</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>日均使用人数(最近30天)</Text>
        <Text style={styles.bigNumber}>{stats.avgDailyActiveUsers}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>功能使用排行(最近30天)</Text>
        {stats.topFeatures.length === 0 ? (
          <Text style={styles.empty}>暂无数据</Text>
        ) : (
          stats.topFeatures.map((f, i) => (
            <Text key={f.screen} style={styles.featureRow}>
              {i + 1}. {labelFor(f.screen)} — {f.count}次
            </Text>
          ))
        )}
      </View>

      <Button title="退出登录" color="#c0392b" onPress={() => logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 16 },
  cardTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: 'bold' },
  bigNumber: { fontSize: 40, fontWeight: 'bold', color: '#3498db', textAlign: 'center' },
  label: { color: '#666', marginTop: 4 },
  featureRow: { fontSize: 14, marginBottom: 6 },
  empty: { textAlign: 'center', marginTop: 16, color: '#888' },
});
