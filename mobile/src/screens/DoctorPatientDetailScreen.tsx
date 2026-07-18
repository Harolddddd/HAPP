import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  getPatientProfile,
  getPatientRecords,
  getPatientAdherence,
  PatientProfile,
  PatientRecord,
  PatientAdherence,
} from '../api/doctor';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorPatientDetail'>;

type Metric = 'bloodPressure' | 'bloodGlucose' | 'weightKg';

export default function DoctorPatientDetailScreen({ route }: Props) {
  const { patientId, patientName } = route.params;
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [adherence, setAdherence] = useState<PatientAdherence | null>(null);
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('bloodPressure');

  useEffect(() => {
    Promise.all([
      getPatientProfile(patientId).catch(() => null),
      getPatientAdherence(patientId).catch(() => null),
      getPatientRecords(patientId, 90).catch(() => []),
    ]).then(([profileData, adherenceData, recordsData]) => {
      setProfile(profileData);
      setAdherence(adherenceData);
      setRecords(recordsData);
      setLoading(false);
    });
  }, [patientId]);

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
      <Text style={styles.title}>{patientName}</Text>

      {profile && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>健康档案</Text>
          <Text>
            年龄: {profile.age}　性别: {profile.gender}
          </Text>
          <Text>
            身高: {profile.heightCm}cm　体重: {profile.weightKg}kg　BMI: {profile.bmi}
          </Text>
          <Text>慢病类型: {profile.chronicConditions.join('、') || '无'}</Text>
          <Text>正在服用药物: {profile.medications.join('、') || '无'}</Text>
          <Text>过敏史: {profile.allergies || '无'}</Text>
        </View>
      )}

      {adherence && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>依从性(最近30天)</Text>
          <Text>
            完成率: {Math.round(adherence.completionRate * 100)}%　连续记录: {adherence.currentStreak}天　漏记:{' '}
            {adherence.missedDays}天
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>90天趋势图</Text>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 16 },
  cardTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  empty: { textAlign: 'center', marginTop: 16, color: '#888' },
});
