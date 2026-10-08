import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dateKey, formatTime, lastDays } from './dates';
import { isDone, streak } from './storage';
import { colors } from './theme';
import type { CompletionLog, Habit } from './types';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = {
  habit: Habit;
  log: CompletionLog;
  onToggle: () => void;
  onEdit: () => void;
};

export function HabitRow({ habit, log, onToggle, onEdit }: Props) {
  const done = isDone(log, habit.id, dateKey());
  const days = streak(log, habit.id);

  return (
    <Pressable onPress={onToggle} onLongPress={onEdit} style={[styles.card, done && styles.cardDone]}>
      <View style={styles.top}>
        <Text style={styles.emoji}>{habit.emoji}</Text>
        <View style={styles.info}>
          <Text style={[styles.name, done && styles.nameDone]}>{habit.name}</Text>
          <Text style={styles.meta}>
            {habit.remindersOn ? `⏰ ${formatTime(habit.hour, habit.minute)}` : 'No reminder'}
            {days > 0 ? `  ·  🔥 ${days} day${days === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
        <Pressable onPress={onEdit} hitSlop={10} style={styles.editButton}>
          <Text style={styles.editText}>•••</Text>
        </Pressable>
        <View style={[styles.check, done && styles.checkDone]}>{done && <Text style={styles.checkMark}>✓</Text>}</View>
      </View>
      <View style={styles.week}>
        {lastDays(7).map((d) => {
          const key = dateKey(d);
          const hit = isDone(log, habit.id, key);
          return (
            <View key={key} style={styles.day}>
              <Text style={styles.dayLabel}>{WEEKDAY[d.getDay()]}</Text>
              <View style={[styles.dot, hit && styles.dotDone]} />
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardDone: { backgroundColor: colors.successSoft },
  top: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 30, marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 18, fontWeight: '600', color: colors.text },
  nameDone: { color: '#1E7A3A' },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
  editButton: { paddingHorizontal: 10 },
  editText: { color: colors.muted, fontSize: 16, letterSpacing: 1 },
  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.empty,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { color: '#fff', fontSize: 18, fontWeight: '700' },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 4 },
  day: { alignItems: 'center', gap: 4 },
  dayLabel: { fontSize: 11, color: colors.muted },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.empty },
  dotDone: { backgroundColor: colors.success },
});
