import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getProfile } from '../api/profile';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((profile) => {
        if (!active) return;
        if (!profile) {
          navigation.replace('ProfileSetup');
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [navigation]);

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>欢迎回来</Text>
      <Button title="今日记录" onPress={() => navigation.navigate('DailyRecord')} />
      <Button title="历史记录" onPress={() => navigation.navigate('History')} />
      <Button title="趋势图" onPress={() => navigation.navigate('Trends')} />
      <Button title="健康提醒" onPress={() => navigation.navigate('Reminders')} />
      <Button title="依从性分析" onPress={() => navigation.navigate('Adherence')} />
      <Button title="编辑健康档案" onPress={() => navigation.navigate('ProfileSetup')} />
      <Button title="退出登录" color="#c0392b" onPress={() => logout()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
});
