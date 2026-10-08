import AsyncStorage from '@react-native-async-storage/async-storage';

import { dateKey, addDays } from './dates';
import type { CompletionLog, Habit } from './types';

const HABITS_KEY = 'habits:v1';
const LOG_KEY = 'log:v1';

export const DEFAULT_HABITS: Habit[] = [
  { id: 'pills-morning', name: 'Morning pills', emoji: '💊', hour: 8, minute: 0, remindersOn: true },
  { id: 'pills-evening', name: 'Evening pills', emoji: '💊', hour: 20, minute: 0, remindersOn: true },
  { id: 'floss', name: 'Floss', emoji: '🦷', hour: 21, minute: 30, remindersOn: true },
];

export async function loadHabits(): Promise<Habit[]> {
  const raw = await AsyncStorage.getItem(HABITS_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_HABITS;
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

export async function loadLog(): Promise<CompletionLog> {
  const raw = await AsyncStorage.getItem(LOG_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveLog(log: CompletionLog): Promise<void> {
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log));
}

export function isDone(log: CompletionLog, habitId: string, day: string): boolean {
  return log[day]?.includes(habitId) ?? false;
}

export function setDone(log: CompletionLog, habitId: string, day: string, done: boolean): CompletionLog {
  const current = log[day] ?? [];
  const without = current.filter((id) => id !== habitId);
  return { ...log, [day]: done ? [...without, habitId] : without };
}

/** Consecutive completed days ending today (or yesterday, if today isn't done yet). */
export function streak(log: CompletionLog, habitId: string, today: Date = new Date()): number {
  let day = isDone(log, habitId, dateKey(today)) ? today : addDays(today, -1);
  let count = 0;
  while (isDone(log, habitId, dateKey(day))) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
