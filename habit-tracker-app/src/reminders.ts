import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, dateKey } from './dates';
import { isDone } from './storage';
import type { CompletionLog, Habit } from './types';

const CHANNEL_ID = 'habit-reminders';
export const CATEGORY_ID = 'habit-reminder';
export const MARK_DONE_ACTION = 'mark-done';

// Reminders are scheduled one-off for each upcoming day (rather than as a repeating
// daily trigger) so a habit you've already checked off today doesn't nag you.
// They are rebuilt every time the app opens or a habit changes.
const DAYS_AHEAD = 14;
// iOS keeps at most 64 pending local notifications per app.
const MAX_PENDING = 60;

export type ReminderData = { habitId: string; day: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Habit reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: MARK_DONE_ACTION, buttonTitle: '✓ Mark as done', options: { opensAppToForeground: true } },
  ]);

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

let queue: Promise<void> = Promise.resolve();

/** Cancel and rebuild all reminders. Calls are serialized so they never interleave. */
export function rescheduleReminders(habits: Habit[], log: CompletionLog): Promise<void> {
  queue = queue.then(() => reschedule(habits, log)).catch((e) => console.warn('Reminder scheduling failed', e));
  return queue;
}

async function reschedule(habits: Habit[], log: CompletionLog): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const pending: { habit: Habit; when: Date; day: string }[] = [];
  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const date = addDays(now, offset);
    const day = dateKey(date);
    for (const habit of habits) {
      if (!habit.remindersOn || isDone(log, habit.id, day)) continue;
      const when = new Date(date.getFullYear(), date.getMonth(), date.getDate(), habit.hour, habit.minute);
      if (when > now) pending.push({ habit, when, day });
    }
  }
  pending.sort((a, b) => a.when.getTime() - b.when.getTime());

  for (const { habit, when, day } of pending.slice(0, MAX_PENDING)) {
    const data: ReminderData = { habitId: habit.id, day };
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${habit.emoji} ${habit.name}`,
        body: 'Time for your daily habit. Tap ✓ once done.',
        categoryIdentifier: CATEGORY_ID,
        data,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL_ID },
    });
  }
}
