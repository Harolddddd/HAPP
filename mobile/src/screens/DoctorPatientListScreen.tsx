import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getPatients, PatientSummary } from '../api/doctor';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorPatientList'>;

export default function DoctorPatientListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [allPatients, setAllPatients] = useState<PatientSummary[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getPatients()
        .then((data) => {
          setAllPatients(data);
          setPatients(data);
          const unique = Array.from(new Set(data.flatMap((p) => p.chronicConditions)));
          setConditions(unique);
          setSelectedCondition(null);
        })
        .finally(() => setLoading(false));
    }, [])
  );

  async function handleSelectCondition(condition: string | null) {
    setSelectedCondition(condition);
    if (condition === null) {
      setPatients(allPatients);
      return;
    }
    setLoading(true);
    try {
      const data = await getPatients(condition);
      setPatients(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.chip, selectedCondition === null && styles.chipSelected]}
          onPress={() => handleSelectCondition(null)}
        >
          <Text style={[styles.chipText, selectedCondition === null && styles.chipTextSelected]}>全部</Text>
        </TouchableOpacity>
        {conditions.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, selectedCondition === c && styles.chipSelected]}
            onPress={() => handleSelectCondition(c)}
          >
            <Text style={[styles.chipText, selectedCondition === c && styles.chipTextSelected]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>暂无患者</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                navigation.navigate('DoctorPatientDetail', { patientId: item.id, patientName: item.name })
              }
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowSubtitle}>
                {item.age != null ? `${item.age}岁` : '年龄未知'} · {item.chronicConditions.join('、') || '无慢病记录'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
      <Button title="退出登录" color="#c0392b" onPress={() => logout()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff' },
  list: { padding: 16 },
  row: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12 },
  rowTitle: { fontWeight: 'bold', fontSize: 16 },
  rowSubtitle: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 32, color: '#888' },
});
