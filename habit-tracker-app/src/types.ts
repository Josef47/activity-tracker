export type Habit = {
  id: string;
  name: string;
  emoji: string;
  /** Reminder time, 24h clock. */
  hour: number;
  minute: number;
  remindersOn: boolean;
  /** Keep sending follow-up reminders every few minutes until the habit is checked off. */
  nag: boolean;
};

/** Date key (YYYY-MM-DD, local time) -> ids of habits completed that day. */
export type CompletionLog = Record<string, string[]>;
