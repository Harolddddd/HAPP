import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getProfile, saveProfile } from '../api/profile';
import { calculateBmi } from '../utils/bmi';
import { useAuth } from '../context/AuthContext';
import { setProfileSetupSkipped } from '../utils/profileSkip';
import PersonAvatar from '../components/PersonAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

const GENDER_OPTIONS = ['男', '女'];
const CHRONIC_OPTIONS = ['无', '高血压', '糖尿病', '高血脂', '心脏病', '其他'];

export default function ProfileSetupScreen({ navigation }: Props) {
  const { user, updateName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [otherCondition, setOtherCondition] = useState('');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profile = await getProfile();
        if (profile) {
          setHasExistingProfile(true);
          setAge(String(profile.age));
          setGender(profile.gender);
          setHeightCm(String(profile.heightCm));
          setWeightKg(String(profile.weightKg));
          const known = profile.chronicConditions.filter((c) => CHRONIC_OPTIONS.includes(c));
          const unknown = profile.chronicConditions.filter((c) => !CHRONIC_OPTIONS.includes(c));
          setChronicConditions(unknown.length > 0 ? [...known, '其他'] : known);
          setOtherCondition(unknown.join(', '));
          setMedications(profile.medications.join(', '));
          setAllergies(profile.allergies ?? '');
        }
      } catch {
        // no existing profile yet (or a transient load error) — start from a blank form
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const heightNum = parseFloat(heightCm);
  const weightNum = parseFloat(weightKg);
  const bmi = heightNum > 0 && weightNum > 0 ? calculateBmi(heightNum, weightNum) : null;

  function toggleCondition(option: string) {
    setChronicConditions((prev) => {
      if (option === '无') {
        return prev.includes('无') ? [] : ['无'];
      }
      const withoutNone = prev.filter((c) => c !== '无');
      return withoutNone.includes(option) ? withoutNone.filter((c) => c !== option) : [...withoutNone, option];
    });
  }

  async function handleSubmit() {
    const missing: string[] = [];
    if (!name) missing.push('姓名');
    if (!age) missing.push('年龄');
    if (!gender) missing.push('性别');
    if (!heightNum) missing.push('身高');
    if (!weightNum) missing.push('体重');
    if (missing.length > 0) {
      setError(`请填写：${missing.join('、')}`);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const finalConditions = chronicConditions.includes('无')
        ? []
        : [
            ...chronicConditions.filter((c) => c !== '其他'),
            ...(chronicConditions.includes('其他')
              ? otherCondition.split(',').map((s) => s.trim()).filter(Boolean)
              : []),
          ];
      if (name !== user?.name) {
        await updateName(name);
      }
      await saveProfile({
        age: parseInt(age, 10),
        gender,
        heightCm: heightNum,
        weightKg: weightNum,
        chronicConditions: finalConditions,
        medications: medications.split(',').map((s) => s.trim()).filter(Boolean),
        allergies,
      });
      navigation.replace('Home');
    } catch (err) {
      setError('保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    await setProfileSetupSkipped();
    navigation.replace('Home');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>健康档案</Text>
      <PersonAvatar />
      <TextInput style={styles.input} placeholder="姓名" maxLength={20} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="年龄" keyboardType="numeric" value={age} onChangeText={setAge} />

      <Text style={styles.label}>性别</Text>
      <View style={styles.chipRow}>
        {GENDER_OPTIONS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, gender === g && styles.chipSelected]}
            onPress={() => setGender(g)}
          >
            <Text style={[styles.chipText, gender === g && styles.chipTextSelected]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="身高 (cm)"
        keyboardType="numeric"
        value={heightCm}
        onChangeText={setHeightCm}
      />
      <TextInput
        style={styles.input}
        placeholder="体重 (kg)"
        keyboardType="numeric"
        value={weightKg}
        onChangeText={setWeightKg}
      />
      {bmi !== null && <Text style={styles.bmi}>BMI: {bmi}</Text>}

      <Text style={styles.label}>慢病类型</Text>
      <View style={styles.chipRow}>
        {CHRONIC_OPTIONS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, chronicConditions.includes(c) && styles.chipSelected]}
            onPress={() => toggleCondition(c)}
          >
            <Text style={[styles.chipText, chronicConditions.includes(c) && styles.chipTextSelected]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {chronicConditions.includes('其他') && (
        <TextInput
          style={styles.input}
          placeholder="请填写具体慢病类型"
          value={otherCondition}
          onChangeText={setOtherCondition}
        />
      )}

      <TextInput style={styles.input} placeholder="正在服用药物" value={medications} onChangeText={setMedications} />
      <TextInput style={styles.input} placeholder="过敏史" value={allergies} onChangeText={setAllergies} />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={submitting ? '保存中...' : '保存'} onPress={handleSubmit} disabled={submitting} />
      {!hasExistingProfile && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>暂时跳过，以后再完善</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  label: { fontSize: 14, color: '#555', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  bmi: { fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  error: { color: '#e74c3c', marginBottom: 12, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 16 },
  chipSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff' },
  skipButton: { marginTop: 16, alignItems: 'center', padding: 8 },
  skipText: { color: '#3498db' },
});
