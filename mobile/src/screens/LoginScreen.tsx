import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import PasswordInput, { PasswordInputHandle } from '../components/PasswordInput';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<PasswordInputHandle>(null);

  async function handleLogin() {
    passwordRef.current?.hideNow();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError('邮箱或密码不正确');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>登录</Text>
      <TextInput
        style={styles.input}
        placeholder="邮箱或手机号"
        autoCapitalize="none"
        maxLength={25}
        value={email}
        onChangeText={setEmail}
      />
      <PasswordInput ref={passwordRef} style={styles.input} placeholder="密码" value={password} onChangeText={setPassword} />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={submitting ? '登录中...' : '登录'} onPress={handleLogin} disabled={submitting} />
      <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.linkText}>没有账号？去注册</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  error: { color: '#e74c3c', marginBottom: 12, textAlign: 'center' },
  linkButton: { marginTop: 16, alignItems: 'center', padding: 8 },
  linkText: { color: '#3498db' },
});
