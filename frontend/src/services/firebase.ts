/**
 * Firebase Authentication Service
 * Provides real Google Sign-In with the native account chooser popup
 * — exactly like Groww, Apple, and other major websites.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';

// ─── Firebase Configuration ─────────────────────────────────────
// To use your own Firebase project:
//   1. Go to https://console.firebase.google.com
//   2. Create a project (free tier)
//   3. Enable Authentication → Sign-in method → Google
//   4. Copy your config and paste below OR set env vars
//
// The config below is a development placeholder.
// Replace it with your own Firebase project config for production.
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || 'AIzaSyDOCAbC123dEf456GhI789jKl012-MnO',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || 'pulseai-stock-analyzer.firebaseapp.com',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || 'pulseai-stock-analyzer',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || 'pulseai-stock-analyzer.appspot.com',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || '1:1234567890:web:abc123def456',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

function getFirebaseAuth(): Auth {
  if (!auth) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    // Force account selection every time (so user sees the account picker)
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  }
  return auth;
}

function getGoogleProvider(): GoogleAuthProvider {
  if (!googleProvider) {
    getFirebaseAuth(); // initializes provider
  }
  return googleProvider!;
}

// ─── Types ──────────────────────────────────────────────────────
export interface GoogleUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

// ─── Sign In With Google Popup ──────────────────────────────────
/**
 * Opens the real Google account chooser popup.
 * This is the exact same experience as Groww, Apple, etc.
 * Returns the authenticated user's real Google profile.
 */
export async function signInWithGooglePopup(): Promise<GoogleUser> {
  const a = getFirebaseAuth();
  const provider = getGoogleProvider();

  const result = await signInWithPopup(a, provider);
  const user = result.user;

  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL,
  };
}

// ─── Sign Out ───────────────────────────────────────────────────
export async function signOutFirebase(): Promise<void> {
  const a = getFirebaseAuth();
  await firebaseSignOut(a);
}

// ─── Auth State Listener ────────────────────────────────────────
export function onAuthChange(callback: (user: GoogleUser | null) => void): () => void {
  const a = getFirebaseAuth();
  return onAuthStateChanged(a, (fbUser: FirebaseUser | null) => {
    if (fbUser) {
      callback({
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
        photoURL: fbUser.photoURL,
      });
    } else {
      callback(null);
    }
  });
}

// ─── Get Current Firebase User ──────────────────────────────────
export function getCurrentFirebaseUser(): GoogleUser | null {
  const a = getFirebaseAuth();
  const u = a.currentUser;
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email || '',
    displayName: u.displayName || u.email?.split('@')[0] || 'User',
    photoURL: u.photoURL,
  };
}
