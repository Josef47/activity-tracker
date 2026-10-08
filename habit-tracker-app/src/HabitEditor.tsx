import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatTime } from './dates';
import { FOLLOW_UP_EVERY_MINUTES, QUIET_FOLLOW_UPS } from './reminders';
import { colors } from './theme';
import type { Habit } from './types';

const EMOJIS = ['💊', '🦷', '💧', '🏃', '📖', '🧘', '🥗', '😴', '🧴', '✅'];

type Props = {
  habit: Habit | null; // null = closed
  isNew: boolean;
  onSave: (habit: Habit) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function HabitEditor({ habit, isNew, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Habit | null>(habit);
  useEffect(() => setDraft(habit), [habit]);

  if (!draft) return null;
  const update = (patch: Partial<Habit>) => setDraft({ ...draft, ...patch });
  const shiftTime = (minutes: number) => {
    const total = (draft.hour * 60 + draft.minute + minutes + 24 * 60) % (24 * 60);
    update({ hour: Math.floor(total / 60), minute: total % 60 });
  };

  const save = () => {
    const name = draft.name.trim();
    if (!name) return Alert.alert('Please give your habit a name');
    onSave({ ...draft, name });
  };

  const confirmDelete = () =>
    Alert.alert(`Delete “${draft.name}”?`, 'Its history will be kept but it will no longer be shown.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(draft.id) },
    ]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.headerButton}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{isNew ? 'New habit' : 'Edit habit'}</Text>
          <Pressable onPress={save} hitSlop={12}>
            <Text style={[styles.headerButton, styles.bold]}>Save</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={draft.name}
          onChangeText={(name) => update({ name })}
          placeholder="e.g. Morning pills"
          placeholderTextColor={colors.muted}
          autoFocus={isNew}
        />

        <Text style={styles.label}>Icon</Text>
        <View style={styles.emojiRow}>
          {EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => update({ emoji })}
              style={[styles.emoji, draft.emoji === emoji && styles.emojiSelected]}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Daily reminder</Text>
          <Switch value={draft.remindersOn} onValueChange={(remindersOn) => update({ remindersOn })} />
        </View>

        <View style={[styles.timeRow, !draft.remindersOn && styles.disabled]}>
          <Stepper label="−1h" onPress={() => shiftTime(-60)} />
          <Stepper label="−5m" onPress={() => shiftTime(-5)} />
          <Text style={styles.time}>{formatTime(draft.hour, draft.minute)}</Text>
          <Stepper label="+5m" onPress={() => shiftTime(5)} />
          <Stepper label="+1h" onPress={() => shiftTime(60)} />
        </View>

        <View style={[styles.switchRow, !draft.remindersOn && styles.disabled]}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Keep reminding until done</Text>
            <Text style={styles.switchHint}>
              If you're late, remind again every {FOLLOW_UP_EVERY_MINUTES} min. After {QUIET_FOLLOW_UPS} reminders it
              plays a loud alarm.
            </Text>
          </View>
          <Switch
            value={draft.nag}
            disabled={!draft.remindersOn}
            onValueChange={(nag) => update({ nag })}
          />
        </View>

        {!isNew && (
          <Pressable onPress={confirmDelete} style={styles.delete}>
            <Text style={styles.deleteText}>Delete habit</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stepper, pressed && { opacity: 0.6 }]}>
      <Text style={styles.stepperText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerButton: { fontSize: 17, color: colors.accent },
  bold: { fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  label: { fontSize: 13, color: colors.muted, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    color: colors.text,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emoji: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  emojiSelected: { borderWidth: 2, borderColor: colors.accent },
  emojiText: { fontSize: 24 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
  },
  switchLabel: { fontSize: 17, color: colors.text },
  switchText: { flex: 1, marginRight: 12 },
  switchHint: { fontSize: 13, color: colors.muted, marginTop: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  disabled: { opacity: 0.35 },
  time: { fontSize: 36, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  stepper: { backgroundColor: colors.card, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 10 },
  stepperText: { fontSize: 15, color: colors.accent, fontWeight: '600' },
  delete: { marginTop: 'auto', marginBottom: 24, padding: 14, alignItems: 'center' },
  deleteText: { color: colors.danger, fontSize: 17 },
});
