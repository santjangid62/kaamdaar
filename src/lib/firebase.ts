/**
 * Firebase bootstrap.
 *
 * The app runs fully in DEV MODE until real Firebase credentials are added to
 * `.env.local` (see `.env.local.example`). With credentials present, Auth
 * (phone OTP) and Firestore take over automatically — no code changes needed.
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const firebaseModeLabel = isFirebaseConfigured ? "firebase" : "dev";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured (dev mode)");
  if (!auth) {
    app = initializeApp(firebaseConfig as Record<string, string>);
    auth = getAuth(app);
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured (dev mode)");
  if (!db) {
    if (!app) app = initializeApp(firebaseConfig as Record<string, string>);
    db = getFirestore(app);
  }
  return db;
}
