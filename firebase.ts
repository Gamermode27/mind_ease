
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCP8quuHHt7Ol_C839uYRnOnJW6Z2Ekia4",
  authDomain: "tech-88368.firebaseapp.com",
  projectId: "tech-88368",
  storageBucket: "tech-88368.firebasestorage.app",
  messagingSenderId: "14501732845",
  appId: "1:14501732845:web:8b7786b80b68189032c7e4",
  measurementId: "G-YBBK7DYKCD"
};

let auth: Auth | null = null;
let db: Firestore | null = null;

const initFirebase = () => {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    try {
      enableIndexedDbPersistence(db);
    } catch (e) {
      console.warn("Firestore offline persistence disabled:", (e as Error).message);
    }
    console.log("Firebase initialized successfully.");
  } catch (error) {
    console.warn("Firebase Init failed. Defaulting to Local Mode.");
    auth = null;
    db = null;
  }
};

initFirebase();

export { auth, db };
