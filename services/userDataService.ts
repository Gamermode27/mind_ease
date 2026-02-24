import type { User as FirebaseUser } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  ActivityLog,
  ActivityType,
  SessionRecord,
  UserPreferences,
  UserProfile
} from '../types';

const nowIso = () => new Date().toISOString();

const defaultPreferences: UserPreferences = {
  theme: 'system',
  notificationsEnabled: false,
  crisisHotlineVisible: true
};

export const buildInitialProfile = (user: FirebaseUser): UserProfile => ({
  uid: user.uid,
  email: user.email ?? null,
  createdAt: nowIso(),
  lastLoginAt: nowIso(),
  preferences: defaultPreferences,
  stats: {
    totalSessions: 0,
    totalEntries: 0,
    lastActivityAt: nowIso()
  }
});

export const ensureUserProfile = async (user: FirebaseUser): Promise<UserProfile | null> => {
  if (!db) return null;
  const ref = doc(db, 'users', user.uid);
  try {
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      const profile = buildInitialProfile(user);
      await setDoc(ref, profile);
      localStorage.setItem(`mindease_user_profile_${user.uid}`, JSON.stringify(profile));
      return profile;
    }
    const existing = snapshot.data() as UserProfile;
    const updated: UserProfile = {
      ...existing,
      lastLoginAt: nowIso(),
      stats: {
        ...existing.stats,
        lastActivityAt: nowIso()
      }
    };
    await updateDoc(ref, {
      lastLoginAt: updated.lastLoginAt,
      'stats.lastActivityAt': updated.stats.lastActivityAt
    });
    localStorage.setItem(`mindease_user_profile_${user.uid}`, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('ensureUserProfile Firestore error', e);
    return null;
  }
};

export const startSession = async (userId: string): Promise<string | null> => {
  if (!db) return null;
  const session: Omit<SessionRecord, 'id'> = {
    startedAt: nowIso()
  };
  try {
    const ref = await addDoc(collection(db, `users/${userId}/sessions`), session);
    const stored: SessionRecord = { id: ref.id, ...session };
    localStorage.setItem(`mindease_last_session_${userId}`, JSON.stringify(stored));
    await logActivity(userId, 'login', { sessionId: ref.id });
    return ref.id;
  } catch (e) {
    console.error('startSession Firestore error', e);
    return null;
  }
};

export const endSession = async (userId: string, sessionId: string | null) => {
  if (!db || !sessionId) return;
  const ref = doc(db, `users/${userId}/sessions/${sessionId}`);
  try {
    await updateDoc(ref, { endedAt: nowIso() });
    await logActivity(userId, 'logout', { sessionId });
  } catch (e) {
    console.error('endSession Firestore error', e);
  }
};

export const logActivity = async (
  userId: string,
  type: ActivityType,
  metadata?: Record<string, unknown>
): Promise<void> => {
  const entry: Omit<ActivityLog, 'id'> = {
    type,
    createdAt: nowIso(),
    metadata
  };
  if (!db) {
    const key = `mindease_activity_${userId}`;
    const current = localStorage.getItem(key);
    const list: ActivityLog[] = current ? JSON.parse(current) : [];
    const withId: ActivityLog = { id: crypto.randomUUID(), ...entry };
    list.unshift(withId);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
    return;
  }
  try {
    await addDoc(collection(db, `users/${userId}/activityLogs`), entry);
  } catch (e) {
    console.error('logActivity Firestore error', e);
    const key = `mindease_activity_${userId}`;
    const current = localStorage.getItem(key);
    const list: ActivityLog[] = current ? JSON.parse(current) : [];
    const withId: ActivityLog = { id: crypto.randomUUID(), ...entry };
    list.unshift(withId);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
  }
};

export const savePreferences = async (
  userId: string,
  preferences: Partial<UserPreferences>
) => {
  if (!db) {
    const key = `mindease_prefs_${userId}`;
    const existingRaw = localStorage.getItem(key);
    const existing: UserPreferences = existingRaw
      ? JSON.parse(existingRaw)
      : defaultPreferences;
    const merged = { ...existing, ...preferences };
    localStorage.setItem(key, JSON.stringify(merged));
    return;
  }
  const ref = doc(db, 'users', userId);
  try {
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return;
    const current = snapshot.data() as UserProfile;
    const merged: UserPreferences = { ...current.preferences, ...preferences };
    await updateDoc(ref, { preferences: merged });
    localStorage.setItem(`mindease_prefs_${userId}`, JSON.stringify(merged));
  } catch (e) {
    console.error('savePreferences Firestore error', e);
  }
};

export const subscribeToPreferences = (
  userId: string,
  onChange: (preferences: UserPreferences) => void
) => {
  if (!db) {
    const key = `mindease_prefs_${userId}`;
    const existingRaw = localStorage.getItem(key);
    const existing: UserPreferences = existingRaw
      ? JSON.parse(existingRaw)
      : defaultPreferences;
    onChange(existing);
    return () => {};
  }
  const ref = doc(db, 'users', userId);
  return onSnapshot(ref, snapshot => {
    if (!snapshot.exists()) {
      onChange(defaultPreferences);
      return;
    }
    const profile = snapshot.data() as UserProfile;
    onChange(profile.preferences || defaultPreferences);
  }, error => {
    console.error('subscribeToPreferences Firestore error', error);
  });
};
