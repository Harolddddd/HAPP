import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface ReminderForScheduling {
  id: string;
  type: string;
  title: string;
  time: string;
  weekdays: number[];
}

const TYPE_BODY: Record<string, string> = {
  blood_pressure: '测血压',
  medication: '吃药',
  exercise: '运动',
  blood_glucose: '测血糖',
};

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function cancelReminderNotifications(reminderId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter((n) => n.content.data?.reminderId === reminderId);
  await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function scheduleReminderNotifications(reminder: ReminderForScheduling): Promise<void> {
  await cancelReminderNotifications(reminder.id);

  const [hourStr, minuteStr] = reminder.time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const body = reminder.type === 'custom' ? reminder.title : TYPE_BODY[reminder.type] ?? reminder.title;

  for (const weekday of reminder.weekdays) {
    const expoWeekday = weekday + 1; // ours: 0=Sunday..6=Saturday; expo: 1=Sunday..7=Saturday
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '健康提醒',
        body,
        data: { reminderId: reminder.id },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });
  }
}
