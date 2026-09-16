import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../api/auth';
import PasswordInput, { PasswordInputHandle } from '../components/PasswordInput';
import { describeAuthError } from '../utils/authErrors';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'patient', label: '用户' },
  { value: 'doctor', label: '医生' },
];

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<PasswordInputHandle>(null);

  async function handleRegister() {
    passwordRef.current?.hideNow();
    setError(null);
    if (password.length < 4) {
      setError('密码长度需为4-15位');
      return;
    }
    setSubmitting(true);
    try {
      await register(email, password, name, role);
    } catch (err) {
      setError(describeAuthError(err, '注册失败，请检查填写内容后重试'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>注册</Text>
      <View style={styles.chipRow}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.chip, role === r.value && styles.chipSelected]}
            onPress={() => setRole(r.value)}
          >
            <Text style={[styles.chipText, role === r.value && styles.chipTextSelected]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput style={styles.input} placeholder="姓名" maxLength={20} value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="邮箱或手机号"
        autoCapitalize="none"
        maxLength={25}
        value={email}
        onChangeText={setEmail}
      />
      <PasswordInput
        ref={passwordRef}
        style={styles.input}
        placeholder="密码（4-15位）"
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={submitting ? '注册中...' : '注册'} onPress={handleRegister} disabled={submitting} />
      <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.linkText}>已有账号？去登录</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  error: { color: '#e74c3c', marginBottom: 12, textAlign: 'center' },
  chipRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 16 },
  chipSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff' },
  linkButton: { marginTop: 16, alignItems: 'center', padding: 8 },
  linkText: { color: '#3498db' },
});
