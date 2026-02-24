# MindEase Firebase Data Schema

## Collections

- `users/{uid}` (UserProfile)
  - `uid`: string
  - `email`: string | null
  - `createdAt`: ISO string
  - `lastLoginAt`: ISO string
  - `preferences` (UserPreferences)
    - `theme`: 'system' | 'light' | 'dark'
    - `notificationsEnabled`: boolean
    - `crisisHotlineVisible`: boolean
  - `stats`
    - `totalSessions`: number
    - `totalEntries`: number
    - `lastActivityAt`: ISO string | null

- `users/{uid}/entries/{entryId}` (JournalEntry)
  - `text`: string
  - `createdAt`: Firestore Timestamp
  - `moodLabel`: MoodLabel
  - `moodScore`: number
  - `keywords`: string[]
  - `exerciseId`: string
  - `crisisFlag`: boolean
  - `aiAdvice`: string

- `users/{uid}/sessions/{sessionId}` (SessionRecord)
  - `startedAt`: ISO string
  - `endedAt`: ISO string (optional)
  - `deviceInfo`: string (optional)

- `users/{uid}/activityLogs/{logId}` (ActivityLog)
  - `type`: 'login' | 'logout' | 'entry_created' | 'exercise_started' | 'exercise_completed'
  - `createdAt`: ISO string
  - `metadata`: object (optional)

## Offline Caching and Backup

- Firestore offline persistence is enabled in `firebase.ts` using IndexedDB.
- Local backup copies are stored in `localStorage`:
  - `mindease_user_profile_{uid}`
  - `mindease_prefs_{uid}`
  - `mindease_activity_{uid}`
  - `mindease_last_session_{uid}`
  - `mindease_local_{uid}` (local-only journal entries)

