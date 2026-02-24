
export type MoodLabel = 'Happy' | 'Neutral' | 'Sad' | 'Anxious' | 'Angry' | 'Grateful' | 'Tired';

export interface UserPreferences {
  theme: 'system' | 'light' | 'dark';
  notificationsEnabled: boolean;
  crisisHotlineVisible: boolean;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  createdAt: string;
  lastLoginAt: string;
  preferences: UserPreferences;
  stats: {
    totalSessions: number;
    totalEntries: number;
    lastActivityAt: string | null;
  };
}

export interface SessionRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  deviceInfo?: string;
}

export type ActivityType =
  | 'login'
  | 'logout'
  | 'entry_created'
  | 'exercise_started'
  | 'exercise_completed';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface Exercise {
  id: string;
  title: string;
  steps: string[];
  durationSec: number;
  type: 'breathing' | 'grounding' | 'stretch' | 'reflection';
  icon: string;
}

export interface JournalEntry {
  id: string;
  text: string;
  createdAt: string;
  moodLabel: MoodLabel;
  moodScore: number; // -1 to 1
  keywords: string[];
  exerciseId: string;
  crisisFlag: boolean;
  aiAdvice?: string;
}

export interface AnalysisResult {
  moodLabel: MoodLabel;
  moodScore: number;
  keywords: string[];
  crisisFlag: boolean;
  aiAdvice: string;
  suggestedExerciseId: string;
}

export type Screen = 'login' | 'home' | 'history' | 'trends' | 'help' | 'exercise' | 'talk' | 'result';
