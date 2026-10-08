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
// iOS keeps at most 64 pending local notifications per app (2 are kept for the notices below).
const MAX_PENDING = 58;
// Warn this many days before the scheduled reminders run out.
const WARN_DAYS_BEFORE_END = 2;

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

/**
 * Cancel and rebuild all reminders. Calls are serialized so they never interleave.
 * Resolves to the time of the last scheduled reminder (null if none are scheduled).
 */
export function rescheduleReminders(habits: Habit[], log: CompletionLog): Promise<Date | null> {
  const run = queue.then(() => reschedule(habits, log));
  queue = run.then(
    () => undefined,
    (e) => console.warn('Reminder scheduling failed', e),
  );
  return run.catch(() => null);
}

async function reschedule(habits: Habit[], log: CompletionLog): Promise<Date | null> {
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

  const scheduled = pending.slice(0, MAX_PENDING);
  for (const { habit, when, day } of scheduled) {
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

  const last = scheduled.at(-1)?.when ?? null;
  if (last) await scheduleRunningOutNotices(last, now);
  return last;
}

// These only fire if the app isn't opened before reminders run out: opening the app
// reschedules everything, including these notices, further into the future.
async function scheduleRunningOutNotices(last: Date, now: Date): Promise<void> {
  const notices = [
    {
      when: addDays(last, -WARN_DAYS_BEFORE_END),
      title: 'Your reminders end soon',
      body: `Habits plans reminders two weeks ahead. Open the app to keep them coming after ${formatDay(last)}.`,
    },
    {
      when: new Date(last.getTime() + 60 * 1000),
      title: 'Your reminders have stopped',
      body: "Habits hasn't been opened in a while, so no more reminders are scheduled. Open the app to turn them back on.",
    },
  ];
  for (const { when, title, body } of notices) {
    if (when <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL_ID },
    });
  }
}

export function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
