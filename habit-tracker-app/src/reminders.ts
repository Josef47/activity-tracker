import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, dateKey } from './dates';
import { isDone } from './storage';
import type { CompletionLog, Habit } from './types';

const CHANNEL_ID = 'habit-reminders';
const URGENT_CHANNEL_ID = 'habit-reminders-urgent';
export const CATEGORY_ID = 'habit-reminder';
export const MARK_DONE_ACTION = 'mark-done';

// Reminders are scheduled one-off for each upcoming day (rather than as a repeating
// daily trigger) so a habit you've already checked off today doesn't nag you.
// They are rebuilt every time the app opens or a habit changes.
const DAYS_AHEAD = 14;

// Follow-ups for habits with `nag` on: every 5 minutes while the habit isn't checked off.
// The first few use the normal sound; after that they play the loud alarm.
export const FOLLOW_UP_EVERY_MINUTES = 5;
export const QUIET_FOLLOW_UPS = 3;
const LOUD_FOLLOW_UPS = 6;
const ALARM_SOUND = 'alarm.wav';

// iOS keeps at most 64 pending local notifications per app, so there we schedule every
// daily reminder first and spend what's left on the soonest follow-ups. Android has no
// such tight limit. 2 slots are kept for the "running out" notices below.
const MAX_PENDING = Platform.OS === 'ios' ? 62 : 400;
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
    // On Android the sound belongs to the channel, so loud follow-ups get their own.
    // Using the alarm audio stream makes it follow the (usually louder) alarm volume.
    await Notifications.setNotificationChannelAsync(URGENT_CHANNEL_ID, {
      name: 'Late habit alarms',
      description: 'Loud alarm when you are more than 15 minutes late',
      importance: Notifications.AndroidImportance.MAX,
      sound: ALARM_SOUND,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      vibrationPattern: [0, 800, 300, 800, 300, 800],
      enableVibrate: true,
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

/** Remove a habit's reminders that are already showing (e.g. after it's checked off). */
export async function dismissHabitNotifications(habitId: string, day: string): Promise<void> {
  const presented = await Notifications.getPresentedNotificationsAsync();
  for (const n of presented) {
    const data = n.request.content.data as Partial<ReminderData>;
    if (data?.habitId === habitId && data.day === day) {
      await Notifications.dismissNotificationAsync(n.request.identifier);
    }
  }
}

let queue: Promise<void> = Promise.resolve();

/**
 * Cancel and rebuild all reminders. Calls are serialized so they never interleave.
 * Resolves to the time of the last scheduled daily reminder (null if none are scheduled).
 */
export function rescheduleReminders(habits: Habit[], log: CompletionLog): Promise<Date | null> {
  const run = queue.then(() => reschedule(habits, log));
  queue = run.then(
    () => undefined,
    (e) => console.warn('Reminder scheduling failed', e),
  );
  return run.catch(() => null);
}

type Planned = { when: Date; content: Notifications.NotificationContentInput; channelId: string };

async function reschedule(habits: Habit[], log: CompletionLog): Promise<Date | null> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const reminders: Planned[] = [];
  const followUps: Planned[] = [];
  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const date = addDays(now, offset);
    const day = dateKey(date);
    for (const habit of habits) {
      if (!habit.remindersOn || isDone(log, habit.id, day)) continue;
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), habit.hour, habit.minute);
      const data: ReminderData = { habitId: habit.id, day };
      if (at > now) reminders.push(reminder(habit, at, data));
      if (!habit.nag) continue;
      for (let n = 1; n <= QUIET_FOLLOW_UPS + LOUD_FOLLOW_UPS; n++) {
        const when = new Date(at.getTime() + n * FOLLOW_UP_EVERY_MINUTES * 60 * 1000);
        if (when > now) followUps.push(followUp(habit, when, n, data));
      }
    }
  }
  const byTime = (a: Planned, b: Planned) => a.when.getTime() - b.when.getTime();
  reminders.sort(byTime);
  followUps.sort(byTime);

  const scheduledReminders = reminders.slice(0, MAX_PENDING);
  const scheduled = [...scheduledReminders, ...followUps.slice(0, MAX_PENDING - scheduledReminders.length)];
  for (const { when, content, channelId } of scheduled) {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId },
    });
  }

  const last = scheduledReminders.at(-1)?.when ?? null;
  if (last) await scheduleRunningOutNotices(last, now);
  return last;
}

function reminder(habit: Habit, when: Date, data: ReminderData): Planned {
  return {
    when,
    channelId: CHANNEL_ID,
    content: {
      title: `${habit.emoji} ${habit.name}`,
      body: 'Time for your daily habit. Tap ✓ once done.',
      categoryIdentifier: CATEGORY_ID,
      data,
    },
  };
}

function followUp(habit: Habit, when: Date, n: number, data: ReminderData): Planned {
  const minutesLate = n * FOLLOW_UP_EVERY_MINUTES;
  const loud = n > QUIET_FOLLOW_UPS;
  const doIt = habit.emoji === '💊' ? 'Take your pills now' : 'Do it now';
  return {
    when,
    channelId: loud ? URGENT_CHANNEL_ID : CHANNEL_ID,
    content: {
      title: `${loud ? '🚨 ' : ''}${habit.emoji} ${habit.name}: ${minutesLate} min late`,
      body: `${doIt}, then tap ✓ Mark as done to stop these reminders.`,
      categoryIdentifier: CATEGORY_ID,
      data,
      sound: loud ? ALARM_SOUND : 'default',
      // Lets the alarm through Focus modes on iOS.
      interruptionLevel: loud ? 'timeSensitive' : 'active',
      priority: loud ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH,
    },
  };
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
