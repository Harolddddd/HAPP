import React, { useState } from 'react';
import { Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { saveProfile } from '../api/profile';
import { calculateBmi } from '../utils/bmi';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation }: Props) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const heightNum = parseFloat(heightCm);
  const weightNum = parseFloat(weightKg);
  const bmi = heightNum > 0 && weightNum > 0 ? calculateBmi(heightNum, weightNum) : null;

  async function handleSubmit() {
    if (!age || !gender || !heightNum || !weightNum) {
      Alert.alert('请完整填写', '年龄、性别、身高、体重为必填项');
      return;
    }
    setSubmitting(true);
    try {
      await saveProfile({
        age: parseInt(age, 10),
        gender,
        heightCm: heightNum,
        weightKg: weightNum,
        chronicConditions: chronicConditions.split(',').map((s) => s.trim()).filter(Boolean),
        medications: medications.split(',').map((s) => s.trim()).filter(Boolean),
        allergies,
      });
      navigation.replace('Home');
    } catch (err) {
      Alert.alert('保存失败', '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>健康档案</Text>
      <TextInput style={styles.input} placeholder="年龄" keyboardType="numeric" value={age} onChangeText={setAge} />
      <TextInput style={styles.input} placeholder="性别" value={gender} onChangeText={setGender} />
      <TextInput style={styles.input} placeholder="身高 (cm)" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} />
      <TextInput style={styles.input} placeholder="体重 (kg)" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />
      {bmi !== null && <Text style={styles.bmi}>BMI: {bmi}</Text>}
      <TextInput
        style={styles.input}
        placeholder="慢病类型（逗号分隔，如：高血压,糖尿病）"
        value={chronicConditions}
        onChangeText={setChronicConditions}
      />
      <TextInput
        style={styles.input}
        placeholder="正在服用药物（逗号分隔）"
        value={medications}
        onChangeText={setMedications}
      />
      <TextInput style={styles.input} placeholder="过敏史" value={allergies} onChangeText={setAllergies} />
      <Button title={submitting ? '保存中...' : '保存'} onPress={handleSubmit} disabled={submitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  bmi: { fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
});
