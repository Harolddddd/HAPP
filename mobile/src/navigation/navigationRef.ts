import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToDailyRecord() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('DailyRecord');
  }
}
