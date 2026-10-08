export type Habit = {
  id: string;
  name: string;
  emoji: string;
  /** Reminder time, 24h clock. */
  hour: number;
  minute: number;
  remindersOn: boolean;
};

/** Date key (YYYY-MM-DD, local time) -> ids of habits completed that day. */
export type CompletionLog = Record<string, string[]>;
