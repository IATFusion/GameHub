/**
 * firebase-config.ts  (shared across all IAT Fusion games)
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *  1. Firebase console → Project settings → Your apps → Web → copy the config.
 *  2. Paste the values into FIREBASE_CONFIG below.
 *  3. Each game references this file via the @firebase path alias.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'

// ─── PASTE YOUR FIREBASE CONFIG HERE ─────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyA6xS_yD9Ku8pl35260WeCkgqVKKeSbAdg",
  authDomain: "gamehub-941cb.firebaseapp.com",
  databaseURL: "https://gamehub-941cb-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gamehub-941cb",
  storageBucket: "gamehub-941cb.firebasestorage.app",
  messagingSenderId: "165794207917",
  appId: "1:165794207917:web:9bfffd7da427d846fd0e24",
  measurementId: "G-6QX1VTDJJB"
}
// ─────────────────────────────────────────────────────────────────────────────

// Robust init: reuse existing app on hot-reload, create fresh otherwise.
function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
}

// Lazy getter — never called at module parse time, only when first imported.
// This avoids race conditions where firebase/database hasn't finished
// registering its service before getDatabase() is called.
let _db: Database | undefined
export function getDb(): Database {
  if (!_db) _db = getDatabase(getFirebaseApp(), firebaseConfig.databaseURL)
  return _db
}

// Keep the named export for backwards compat — resolved lazily on first access.
export const db: Database = new Proxy({} as Database, {
  get(_t, prop) {
    return (getDb() as unknown as Record<string, unknown>)[prop as string]
  },
})

/** True once all placeholder values have been replaced. */
export function firebaseConfigured(): boolean {
  return !Object.values(firebaseConfig).some(v => v === 'REPLACE_ME')
}
