
import React, { useState, useEffect } from 'react';
/* Import Firebase Auth values and types separately for better compatibility */
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

import { Screen, JournalEntry, Exercise, AnalysisResult } from './types';
import { EXERCISES } from './constants';
import { analyzeJournalEntry } from './services/geminiService';
import { TrendsChart } from './components/TrendsChart';
import { ExerciseTimer } from './components/ExerciseTimer';
import { LiveSession } from './components/LiveSession';
import { auth, db } from './firebase';
import { ensureUserProfile, startSession, endSession, logActivity } from './services/userDataService';

const MOOD_EMOJIS: Record<string, string> = {
  Happy: '😊',
  Neutral: '😐',
  Sad: '😔',
  Anxious: '😰',
  Angry: '😤',
  Grateful: '🙏',
  Tired: '😴'
};

const App: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | { uid: string; email: string; isLocal: boolean } | null>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentText, setCurrentText] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    // If Firebase auth failed to init or is missing
    if (!auth) {
      setIsLocalMode(true);
      setAuthLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
          const firebaseUser = currentUser as FirebaseUser;
          setUser(firebaseUser);
          ensureUserProfile(firebaseUser)
            .then(() => startSession(firebaseUser.uid))
            .then(id => setSessionId(id));
          setScreen('home');
        }
        setAuthLoading(false);
      }, (err) => {
        console.warn("Firebase Auth Listener Error:", err);
        setIsLocalMode(true);
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Failed to attach Auth listener. Switching to Local Mode.");
      setIsLocalMode(true);
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }

    if (('isLocal' in user && user.isLocal) || !db) {
      const saved = localStorage.getItem(`mindease_local_${user.uid}`);
      if (saved) setEntries(JSON.parse(saved));
      return;
    }

    try {
      const q = query(collection(db, `users/${user.uid}/entries`), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: (doc.data() as any).createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        })) as JournalEntry[];
        setEntries(data);
      }, (err) => {
        console.error("Firestore sync error:", err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore access failed. Using local cache for this session.");
    }
  }, [user]);

  const handleAuth = async () => {
    if (!email || !password || authSubmitting) return;
    
    if (isLocalMode || !auth) {
      handleLocalLogin();
      return;
    }

    setAuthSubmitting(true);
    setAuthError('');
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const code = (err as any)?.code as string | undefined;
      if (code === 'auth/invalid-email') {
        setAuthError('That email address does not look valid.');
      } else if (code === 'auth/weak-password') {
        setAuthError('Password needs at least 6 characters.');
      } else if (code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists. Try signing in.');
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setAuthError('Incorrect email or password.');
      } else if (code === 'auth/operation-not-allowed') {
        setAuthError('Email/password sign-in is disabled for this project.');
      } else if (code === 'auth/network-request-failed') {
        setAuthError('Network error while contacting the server. Please try again.');
      } else if (code === 'auth/invalid-api-key') {
        setAuthError('Invalid Firebase API key. Check your Firebase config.');
      } else {
        setAuthError('There was a problem signing in. Please try again.');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLocalLogin = () => {
    if (!email || !password) {
      setAuthError("Please enter your email and password.");
      return;
    }
    const uidBase = window.crypto?.randomUUID?.() || btoa(email).replace(/[^A-Za-z0-9]/g, '');
    const localUser = {
      uid: uidBase.slice(0, 12),
      email,
      isLocal: true
    };
    setUser(localUser);
    setIsLocalMode(true);
    setAuthError('');
    setScreen('home');
  };

  const handleLogout = () => {
    if (auth && user && !('isLocal' in user && user.isLocal)) {
      try { signOut(auth); } catch(e) {}
    }
    if (user && !('isLocal' in user && user.isLocal)) {
      endSession(user.uid, sessionId);
    }
    setUser(null);
    setScreen('login');
    // Keep local mode preference if it was forced by a bad key
    setAuthError('');
  };

  const handleAnalyze = async () => {
    if (!currentText.trim() || analyzing || !user) return;
    setAnalyzing(true);
    try {
      const result = await analyzeJournalEntry(currentText);
      
      const newEntryData = {
        text: currentText,
        moodLabel: result.moodLabel,
        moodScore: result.moodScore,
        keywords: result.keywords,
        exerciseId: result.suggestedExerciseId,
        crisisFlag: result.crisisFlag,
        aiAdvice: result.aiAdvice
      };

      const createdAtIso = new Date().toISOString();

      if (('isLocal' in user && user.isLocal) || !db) {
        const newEntry = { ...newEntryData, id: crypto.randomUUID(), createdAt: createdAtIso };
        const updated = [newEntry, ...entries];
        setEntries(updated);
        localStorage.setItem(`mindease_local_${user.uid}`, JSON.stringify(updated));
      } else {
        (async () => {
          try {
            await addDoc(collection(db, `users/${user.uid}/entries`), {
              ...newEntryData,
              createdAt: serverTimestamp()
            });
            await logActivity(user.uid, 'entry_created', {
              moodScore: result.moodScore,
              crisisFlag: result.crisisFlag
            });
          } catch (e) {
            console.error('Firestore entry write failed', e);
            const fallbackEntry = { ...newEntryData, id: crypto.randomUUID(), createdAt: createdAtIso };
            const updated = [fallbackEntry, ...entries];
            setEntries(updated);
            localStorage.setItem(`mindease_local_${user.uid}`, JSON.stringify(updated));
          }
        })();
      }
      
      setSelectedEntry({ ...newEntryData, id: 'preview', createdAt: createdAtIso } as JournalEntry);
      setCurrentText('');
      
      if (result.crisisFlag) {
        setScreen('help');
      } else {
        const exercise = EXERCISES.find(e => e.id === result.suggestedExerciseId) || EXERCISES[0];
        setActiveExercise(exercise);
        setScreen('result');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const hasRecentCrisis = entries.slice(0, 5).some(e => e.crisisFlag);
  const getVibeBottomPercent = (score: number) => ((score + 1) / 2) * 100;

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-8 bg-[#020617]">
        <i className="fa-solid fa-brain animate-pulse text-5xl text-blue-400"></i>
      </div>
    );
  }

  if (screen === 'login' || !user) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-8 fade-in">
        <div className="w-24 h-24 bg-blue-500 rounded-[2.8rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 mb-10 animate-float">
          <i className="fa-solid fa-brain text-5xl"></i>
        </div>
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tight mb-2 text-white">MindEase</h1>
          <p className="text-blue-200/50 font-medium text-sm">Your private mental sanctuary.</p>
        </div>
        
        <div className="glass p-10 rounded-[3.8rem] w-full max-w-sm">
          <div className="space-y-6">
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-white placeholder:text-white/20 text-sm"
            />
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-white placeholder:text-white/20 text-sm"
            />

            {!isLocalMode && authError && (
              <div className="p-5 rounded-2xl border transition-all bg-red-500/10 border-red-500/20">
                <p className="text-red-400 text-xs text-center font-bold leading-relaxed">
                  {authError}
                </p>
              </div>
            )}

            {!isLocalMode ? (
              <button 
                onClick={handleAuth}
                disabled={authSubmitting}
                className="w-full py-5 bg-white text-blue-900 font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                {authSubmitting ? <i className="fa-solid fa-circle-notch animate-spin"></i> : isSignUp ? "Create Account" : "Sign In"}
              </button>
            ) : (
              <button 
                onClick={handleLocalLogin}
                className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 glow-blue"
              >
                <i className="fa-solid fa-lock text-sm opacity-60"></i>
                Start Secure Local Mode
              </button>
            )}
            
            <button 
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); setIsLocalMode(false); }}
              className="w-full text-[10px] font-black uppercase tracking-[0.25em] text-blue-300/40 hover:text-white transition-colors pt-2"
            >
              {isSignUp ? "Already have an account? Sign In" : "New here? Create Account"}
            </button>
          </div>
        </div>
        
        {isLocalMode && (
          <p className="mt-10 text-[9px] text-blue-300/30 uppercase font-black tracking-widest px-10 text-center leading-relaxed">
            Firebase unreachable with this API Key.<br/>Data is stored privately in your browser.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col min-h-screen pb-28 fade-in">
      {screen === 'talk' && <LiveSession onClose={() => setScreen('home')} />}

      <header className="p-8 flex flex-col items-center gap-4 relative">
        <button 
          onClick={handleLogout}
          className="absolute top-8 left-8 w-10 h-10 glass rounded-xl flex items-center justify-center text-white/30 hover:text-white transition-all"
        >
          <i className="fa-solid fa-right-from-bracket text-sm"></i>
        </button>
        
        <div className="w-14 h-14 bg-blue-500 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/40">
          <i className="fa-solid fa-brain text-2xl"></i>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight text-white">MindEase</h1>
          <div className="flex items-center gap-2 justify-center mt-1">
             <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLocalMode ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-green-400 shadow-[0_0_8px_#4ade80]'}`}></span>
             <p className="text-[10px] text-blue-300 font-black uppercase tracking-[0.2em]">
               {isLocalMode ? 'Local Mode' : 'Cloud Sync'}
             </p>
          </div>
        </div>
      </header>

      <main className="px-6 flex-1 flex flex-col">
        {screen === 'home' && (
          <div className="space-y-6 flex-1 flex flex-col justify-center">
            <div className="glass p-8 rounded-[3rem] relative">
              <h2 className="text-3xl font-black mb-2 text-white">Hey you.</h2>
              <p className="text-blue-200/60 mb-8 text-sm font-medium">What's the energy today?</p>
              
              <textarea
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                placeholder="Start typing..."
                className="w-full h-48 bg-transparent text-white placeholder:text-white/10 outline-none text-xl leading-relaxed resize-none"
              />
              
              <div className="mt-8 flex items-center justify-between">
                <button 
                  onClick={() => setScreen('talk')}
                  className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-blue-300 hover:text-white transition-all"
                >
                  <i className="fa-solid fa-microphone-lines text-xl"></i>
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={!currentText.trim() || analyzing}
                  className="px-10 py-4 bg-white text-blue-900 font-extrabold rounded-2xl shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-20 transition-all flex items-center gap-3"
                >
                  {analyzing ? <i className="fa-solid fa-circle-notch animate-spin text-xl"></i> : "Check Vibe"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="glass p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                  <i className="fa-solid fa-bolt-lightning text-amber-400 text-2xl mb-2"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Logs</p>
                  <p className="text-2xl font-black text-white">{entries.length}</p>
               </div>
               <div className="glass p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                  <i className="fa-solid fa-spa text-blue-400 text-2xl mb-2"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Relief</p>
                  <p className="text-2xl font-black text-white">Breath</p>
               </div>
            </div>
          </div>
        )}

        {screen === 'result' && selectedEntry && (
          <div className="flex-1 flex flex-col">
            <div className="glass-light flex-1 p-10 rounded-[4rem] shadow-2xl relative overflow-hidden text-slate-900 flex flex-col items-center">
               <div className="flex-1 w-full flex items-center justify-between gap-8 mb-8">
                 <div className="flex flex-col items-center gap-4">
                    <div className="vibe-vertical shadow-inner h-64 w-4 bg-slate-100 rounded-full relative overflow-visible">
                      <div className="absolute inset-0 bg-gradient-to-t from-indigo-100 via-blue-200 to-green-100 opacity-50 rounded-full"></div>
                      <div 
                        className="vibe-indicator w-10 h-10 bg-blue-600 border-[6px] border-white rounded-full shadow-2xl absolute left-1/2 -translate-x-1/2 z-20"
                        style={{ bottom: `calc(${getVibeBottomPercent(selectedEntry.moodScore)}% - 20px)` }}
                      ></div>
                    </div>
                    <p className="text-[8px] font-black text-slate-300 uppercase vertical-text tracking-widest">Vibe Level</p>
                 </div>
                 <div className="flex-1 flex flex-col items-center text-center pt-8">
                    <div className="w-32 h-32 bg-blue-50 rounded-[3.5rem] flex items-center justify-center text-7xl mb-6 shadow-inner animate-float">
                      {MOOD_EMOJIS[selectedEntry.moodLabel]}
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Today you're</p>
                    <h2 className="text-5xl font-black text-blue-900 mb-6">{selectedEntry.moodLabel}</h2>
                    <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                      <p className="text-slate-600 text-lg font-medium leading-relaxed italic">"{selectedEntry.aiAdvice}"</p>
                    </div>
                 </div>
               </div>
               <button onClick={() => {
                  const exercise = EXERCISES.find(e => e.id === selectedEntry.exerciseId) || EXERCISES[0];
                  setActiveExercise(exercise);
                  setScreen('exercise');
               }} className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-2xl shadow-2xl hover:bg-blue-700 active:scale-95 transition-all mb-4 glow-blue">
                 Let's Ground
               </button>
               <button 
                  onClick={() => setScreen('home')}
                  className="text-slate-400 font-black uppercase text-[10px] tracking-widest py-2"
                >
                  Save & Exit
                </button>
            </div>
          </div>
        )}

        {screen === 'exercise' && activeExercise && (
          <div className="flex-1 flex flex-col justify-center">
            <ExerciseTimer exercise={activeExercise} onComplete={() => setScreen('home')} />
          </div>
        )}

        {screen === 'history' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black px-2 tracking-tight text-white">Your Story</h2>
            <div className="space-y-4">
              {entries.length === 0 ? (
                <div className="glass p-20 rounded-[3rem] text-center opacity-30">
                  <i className="fa-solid fa-book-open text-4xl mb-4"></i>
                  <p className="font-black uppercase text-[10px] tracking-widest">Journal is empty</p>
                </div>
              ) : (
                entries.map(entry => (
                  <div key={entry.id} className="glass p-6 rounded-[2.5rem] flex items-center gap-5">
                    <div className="w-16 h-16 bg-white/5 rounded-[1.8rem] flex items-center justify-center text-4xl">{MOOD_EMOJIS[entry.moodLabel]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">
                        {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm font-bold text-white line-clamp-1">{entry.moodLabel}</p>
                      <p className="text-xs text-white/40 line-clamp-1 italic">"{entry.text}"</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {screen === 'trends' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black px-2 tracking-tight text-white">Trends</h2>
            <div className="glass p-8 rounded-[3rem] h-96">
              <TrendsChart entries={entries} />
            </div>
            <div className="glass p-6 rounded-[2.5rem] flex items-center justify-between px-10">
               <div className="text-center">
                  <p className="text-2xl font-black text-blue-300">{entries.length}</p>
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Checks</p>
               </div>
               <div className="h-10 w-px bg-white/10"></div>
               <div className="text-center">
                  <p className="text-2xl font-black text-green-300">
                    {entries.filter(e => e.moodScore > 0).length}
                  </p>
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Highs</p>
               </div>
            </div>
          </div>
        )}

        {screen === 'help' && (
          <div className="space-y-8 flex-1 flex flex-col justify-center">
            <div className="text-center">
              <div className="w-24 h-24 bg-red-500/20 rounded-[3rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                 <i className="fa-solid fa-shield-heart text-red-500 text-4xl"></i>
              </div>
              <h2 className="text-3xl font-black mb-3 text-white">You're Not Alone.</h2>
              <p className="text-blue-200/50 font-medium px-4">There are humans ready to support you right now. Don't hesitate to reach out.</p>
            </div>
            <div className="space-y-4">
              <a href="tel:988" className="glass p-8 rounded-[2.5rem] flex items-center gap-6 active:scale-95 transition-all">
                 <i className="fa-solid fa-phone-volume text-blue-400 text-3xl"></i>
                 <div>
                    <h4 className="font-black text-white text-lg">988 Lifeline</h4>
                    <p className="text-blue-300 font-black text-xs uppercase tracking-widest">Call or Text 988</p>
                 </div>
              </a>
              <a href="sms:741741" className="glass p-8 rounded-[2.5rem] flex items-center gap-6 active:scale-95 transition-all">
                 <i className="fa-solid fa-comments text-blue-400 text-3xl"></i>
                 <div>
                    <h4 className="font-black text-white text-lg">Crisis Text Line</h4>
                    <p className="text-blue-300 font-black text-xs uppercase tracking-widest">Text HOME to 741741</p>
                 </div>
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-[380px] glass rounded-[2.8rem] p-3 flex items-center justify-around z-[999] shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
      <NavButton active={screen === 'home'} onClick={() => setScreen('home')} icon="fa-house" />
      <NavButton active={screen === 'history'} onClick={() => setScreen('history')} icon="fa-book-open" />
      <NavButton active={screen === 'trends'} onClick={() => setScreen('trends')} icon="fa-chart-simple" />
      <NavButton active={screen === 'help'} onClick={() => setScreen('help')} icon="fa-shield-heart" danger={hasRecentCrisis} />
    </nav>
    </>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: string; danger?: boolean }> = ({ active, onClick, icon, danger }) => (
  <button
    onClick={onClick}
    className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-500 ${
      active ? 'bg-blue-600 text-white scale-110 shadow-2xl shadow-blue-600/50' : 'text-black/70 hover:text-black'
    }`}
  >
    <i className={`fa-solid ${icon} text-xl`}></i>
    {danger && <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-ping"></span>}
  </button>
);

export default App;
