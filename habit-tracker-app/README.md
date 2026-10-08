# Habits

A simple native phone app (iOS + Android, built with React Native / Expo) for tracking daily habits, with reminders.

It ships with three habits ready to go:

| Habit | Reminder | Keep reminding until done |
| --- | --- | --- |
| 💊 Morning pills | 08:00 | on |
| 💊 Evening pills | 20:00 | on |
| 🦷 Floss | 21:30 | off |

## Features

- **Check off habits** for today with one tap.
- **Daily reminders** as local notifications, with a **"✓ Mark as done"** button right on the notification.
- **Keep reminding until done** (per habit): if you're late, you get another reminder every 5 minutes. From the 4th one on (20 min late) it plays a **loud alarm** with a longer beep, until you're 45 minutes late. Checking the habit off stops them and clears any reminders still showing.
- A habit already checked off today won't remind you again that day.
- **Streaks** (🔥) and a 7-day history for each habit.
- Add, rename, re-time or delete habits (tap **•••** or long-press a habit).
- Everything is stored on your phone. No account and no server.

## Run it on your phone

You need [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npx expo start
```

Then scan the QR code with the **Expo Go** app ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)). Local reminders work in Expo Go, but the **loud alarm sound needs a real build** (see below). In Expo Go it falls back to the normal notification sound.

## Install it as a standalone app

Build it in the cloud with [EAS](https://expo.dev/eas). A free Expo account works, and you don't need Xcode or Android Studio.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview   # gives you an .apk to install
npx eas-cli@latest build --platform ios --profile preview       # needs an Apple Developer account
```

## How reminders work

Reminders are scheduled as one-off notifications for the next 14 days and rebuilt each time you open the app or change a habit. That way any habit you've already done is skipped.

So you're never left wondering why reminders stopped:

- The main screen shows the date reminders are planned up to.
- **2 days before they run out**, you get a "Your reminders end soon" notification.
- If you still haven't opened the app, a final **"Your reminders have stopped"** notification explains why and asks you to open the app.

**Follow-up reminders on iPhone:** iOS lets an app keep only 64 reminders scheduled at a time. The app schedules all daily reminders first and uses the remaining slots for the soonest follow-ups, which covers about the next day. Every time you open the app (including by tapping ✓ Mark as done), it tops them up again. Android doesn't have this limit, so follow-ups are scheduled for the full two weeks there.

**Loudness:** the alarm (`assets/sounds/alarm.wav`) is a loud, high-pitched beep pattern. On Android it plays on the *alarm* volume, so it's loud even when your ringer is quiet. On iPhone it uses the ringer volume and won't play if the phone is on silent, because only Apple-approved apps can override silent mode. It is marked *time-sensitive*, so it does get through Focus modes.

Opening the app at any point pushes all of this two weeks further out, so if you use the app regularly you'll never see these notices.

## Project layout

```
App.tsx              Main screen (today's habits)
src/HabitRow.tsx     A habit card: checkbox, streak, 7-day history
src/HabitEditor.tsx  Add / edit habit sheet
src/reminders.ts     Notification permissions + scheduling
src/storage.ts       On-device storage, streaks
src/dates.ts         Date helpers
```
