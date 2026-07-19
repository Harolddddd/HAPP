import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';
import { navigationRef, navigateToDailyRecord } from './navigationRef';
import { getReminders } from '../api/reminders';
import { scheduleReminderNotifications, cancelReminderNotifications } from '../utils/notifications';
import { logUsageEvent } from '../api/usage';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import DailyRecordScreen from '../screens/DailyRecordScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TrendsScreen from '../screens/TrendsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ReminderFormScreen from '../screens/ReminderFormScreen';
import AdherenceScreen from '../screens/AdherenceScreen';
import DoctorPatientListScreen from '../screens/DoctorPatientListScreen';
import DoctorPatientDetailScreen from '../screens/DoctorPatientDetailScreen';
import AdminStatsScreen from '../screens/AdminStatsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { token, isLoading, user } = useAuth();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      navigateToDailyRecord();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!token || user?.role !== 'patient') return;
    getReminders()
      .then((reminders) => {
        reminders.forEach((reminder) => {
          if (reminder.enabled) {
            scheduleReminderNotifications(reminder).catch(() => {});
          } else {
            cancelReminderNotifications(reminder.id).catch(() => {});
          }
        });
      })
      .catch(() => {});
  }, [token, user]);

  if (isLoading || (token && !user)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => {
        if (!token) return;
        const routeName = navigationRef.getCurrentRoute()?.name;
        if (routeName) {
          logUsageEvent(routeName);
        }
      }}
    >
      <Stack.Navigator>
        {token && user?.role === 'doctor' ? (
          <>
            <Stack.Screen name="DoctorPatientList" component={DoctorPatientListScreen} options={{ title: '患者列表' }} />
            <Stack.Screen
              name="DoctorPatientDetail"
              component={DoctorPatientDetailScreen}
              options={{ title: '患者详情' }}
            />
          </>
        ) : token && user?.role === 'admin' ? (
          <Stack.Screen name="AdminStats" component={AdminStatsScreen} options={{ title: '后台统计' }} />
        ) : token ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ title: '健康档案' }} />
            <Stack.Screen name="DailyRecord" component={DailyRecordScreen} options={{ title: '今日记录' }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ title: '历史记录' }} />
            <Stack.Screen name="Trends" component={TrendsScreen} options={{ title: '趋势图' }} />
            <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: '健康提醒' }} />
            <Stack.Screen name="ReminderForm" component={ReminderFormScreen} options={{ title: '编辑提醒' }} />
            <Stack.Screen name="Adherence" component={AdherenceScreen} options={{ title: '依从性分析' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: '登录' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '注册' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
