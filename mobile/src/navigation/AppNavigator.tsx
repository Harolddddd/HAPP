import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import DailyRecordScreen from '../screens/DailyRecordScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TrendsScreen from '../screens/TrendsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {token ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ title: '健康档案' }} />
            <Stack.Screen name="DailyRecord" component={DailyRecordScreen} options={{ title: '今日记录' }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ title: '历史记录' }} />
            <Stack.Screen name="Trends" component={TrendsScreen} options={{ title: '趋势图' }} />
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
