# Habits

A simple native phone app (iOS + Android, built with React Native / Expo) for tracking daily habits, with reminders.

It ships with three habits ready to go:

| Habit | Reminder |
| --- | --- |
| 💊 Morning pills | 08:00 |
| 💊 Evening pills | 20:00 |
| 🦷 Floss | 21:30 |

## Features

- **Check off habits** for today with one tap.
- **Daily reminders** as local notifications, with a **"✓ Mark as done"** button right on the notification.
- **No nagging**: a habit already checked off today won't remind you again that day.
- **Streaks** (🔥) and a 7-day history for each habit.
- Add, rename, re-time or delete habits (tap **•••** or long-press a habit).
- Everything is stored on your phone. No account and no server.

## Run it on your phone

You need [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npx expo start
```

Then scan the QR code with the **Expo Go** app ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)). Local reminders work in Expo Go.

## Install it as a standalone app

Build it in the cloud with [EAS](https://expo.dev/eas). A free Expo account works, and you don't need Xcode or Android Studio.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview   # gives you an .apk to install
npx eas-cli@latest build --platform ios --profile preview       # needs an Apple Developer account
```

## How reminders work

Reminders are scheduled as one-off notifications for the next 14 days and rebuilt each time you open the app or change a habit. That way any habit you've already done is skipped. If you don't open the app for more than two weeks, the reminders run out until you open it again.

## Project layout

```
App.tsx              Main screen (today's habits)
src/HabitRow.tsx     A habit card: checkbox, streak, 7-day history
src/HabitEditor.tsx  Add / edit habit sheet
src/reminders.ts     Notification permissions + scheduling
src/storage.ts       On-device storage, streaks
src/dates.ts         Date helpers
```
