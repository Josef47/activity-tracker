import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { HabitEditor } from './src/HabitEditor';
import { HabitRow } from './src/HabitRow';
import { dateKey } from './src/dates';
import { MARK_DONE_ACTION, ReminderData, rescheduleReminders, setupNotifications } from './src/reminders';
import { isDone, loadHabits, loadLog, saveHabits, saveLog, setDone } from './src/storage';
import { colors } from './src/theme';
import type { CompletionLog, Habit } from './src/types';

export default function App() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [log, setLog] = useState<CompletionLog>({});
  const [editing, setEditing] = useState<{ habit: Habit; isNew: boolean } | null>(null);
  const [notificationsAllowed, setNotificationsAllowed] = useState(true);
  const [today, setToday] = useState(dateKey());

  // Initial load.
  useEffect(() => {
    Promise.all([loadHabits(), loadLog()]).then(([h, l]) => {
      setLog(l);
      setHabits(h);
    });
    setupNotifications().then(setNotificationsAllowed);
  }, []);

  // Persist and keep reminders in sync whenever data changes.
  const loaded = habits !== null;
  useEffect(() => {
    if (!habits) return;
    saveHabits(habits);
    saveLog(log);
    rescheduleReminders(habits, log);
  }, [habits, log]);

  // Refresh "today" (and reminders) when the app comes back to the foreground.
  const latest = useRef({ habits, log });
  latest.current = { habits, log };
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setToday(dateKey());
      if (latest.current.habits) rescheduleReminders(latest.current.habits, latest.current.log);
    });
    return () => sub.remove();
  }, []);

  // "Mark as done" button on a reminder notification.
  const handleResponse = useCallback((response: Notifications.NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== MARK_DONE_ACTION) return;
    const { habitId, day } = response.notification.request.content.data as ReminderData;
    if (habitId && day) setLog((l) => setDone(l, habitId, day, true));
    Notifications.dismissNotificationAsync(response.notification.request.identifier);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    Notifications.getLastNotificationResponseAsync().then((r) => {
      handleResponse(r);
      Notifications.clearLastNotificationResponseAsync();
    });
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [loaded, handleResponse]);

  if (!habits) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  const toggle = (id: string) => setLog((l) => setDone(l, id, today, !isDone(l, id, today)));
  const saveHabit = (habit: Habit) => {
    setHabits((hs) => (hs!.some((h) => h.id === habit.id) ? hs!.map((h) => (h.id === habit.id ? habit : h)) : [...hs!, habit]));
    setEditing(null);
  };
  const deleteHabit = (id: string) => {
    setHabits((hs) => hs!.filter((h) => h.id !== id));
    setEditing(null);
  };
  const newHabit = () =>
    setEditing({
      isNew: true,
      habit: { id: String(Date.now()), name: '', emoji: '✅', hour: 9, minute: 0, remindersOn: true },
    });

  const sorted = [...habits].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  const doneCount = habits.filter((h) => isDone(log, h.id, today)).length;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.date}>{dateLabel}</Text>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.progress}>
            {habits.length === 0
              ? 'Add a habit to get started'
              : doneCount === habits.length
                ? '🎉 All done for today!'
                : `${doneCount} of ${habits.length} done`}
          </Text>

          {!notificationsAllowed && (
            <Pressable style={styles.banner} onPress={() => Linking.openSettings()}>
              <Text style={styles.bannerText}>Reminders are off. Tap to allow notifications in Settings.</Text>
            </Pressable>
          )}

          {sorted.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              log={log}
              onToggle={() => toggle(habit.id)}
              onEdit={() => setEditing({ habit, isNew: false })}
            />
          ))}

          <Pressable style={styles.add} onPress={newHabit}>
            <Text style={styles.addText}>＋ Add habit</Text>
          </Pressable>
          <Text style={styles.hint}>Tap a habit to check it off · long-press or ••• to edit</Text>
        </ScrollView>

        <HabitEditor
          habit={editing?.habit ?? null}
          isNew={editing?.isNew ?? false}
          onSave={saveHabit}
          onDelete={deleteHabit}
          onClose={() => setEditing(null)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 48 },
  date: { fontSize: 14, color: colors.muted, textTransform: 'uppercase', fontWeight: '600' },
  title: { fontSize: 34, fontWeight: '700', color: colors.text, marginTop: 2 },
  progress: { fontSize: 16, color: colors.muted, marginTop: 4, marginBottom: 20 },
  banner: { backgroundColor: '#FFF4E5', borderRadius: 12, padding: 12, marginBottom: 16 },
  bannerText: { color: '#8A5300', fontSize: 14 },
  add: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.empty,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addText: { fontSize: 17, color: colors.accent, fontWeight: '600' },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 13, marginTop: 16 },
});
