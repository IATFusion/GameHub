/**
 * leaderboard.ts  –  target-clicker
 *
 * Leaderboard backed by Firebase Realtime Database.
 * Shared Firebase app is initialised in Gaming/firebase/firebase-config.ts.
 *
 * Data lives at:  /leaderboards/target-clicker/scores
 *
 * ─── SETUP ───────────────────────────────────────────────────────────────────
 *  1. Complete the setup in Gaming/firebase/firebase-config.ts (paste your
 *     Firebase project config values into FIREBASE_CONFIG).
 *  2. In the Firebase console enable Realtime Database and set rules:
 *       {
 *         "rules": {
 *           "leaderboards": {
 *             "$gameId": { ".read": true, ".write": true }
 *           }
 *         }
 *       }
 *  That's it – no other config needed here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ref, get, set } from 'firebase/database'

import { db, firebaseConfigured } from '~firebase/firebase-config'

/** The RTDB path key for this game's leaderboard. */
const GAME_ID     = 'target-clicker'
const SCORES_PATH = `leaderboards/${GAME_ID}/scores`

/** Maximum entries kept on the board. */
const MAX_ENTRIES = 10

export interface LeaderboardEntry {
  name:  string
  score: number
  date:  string // ISO date string (date only)
}

/** Returns true when Firebase credentials have been filled in. */
export function leaderboardConfigured(): boolean {
  return firebaseConfigured()
}

/** Fetch the current top entries. Falls back to [] on error. */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!leaderboardConfigured()) return []
  try {
    const snapshot = await get(ref(db, SCORES_PATH))
    if (!snapshot.exists()) return []
    const data = snapshot.val() as LeaderboardEntry[] | Record<string, LeaderboardEntry>
    // RTDB can return an array or object depending on structure – normalise to array
    const entries: LeaderboardEntry[] = Array.isArray(data)
      ? data
      : Object.values(data)
    return entries.sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

/**
 * Submit a new score.  Each player gets one slot (personal best only).
 * - If the player already has an equal or higher score nothing is written.
 * Returns the updated board, or null on failure.
 */
export async function submitScore(
  name:  string,
  score: number,
): Promise<LeaderboardEntry[] | null> {
  if (!leaderboardConfigured()) return null

  const existing = await fetchLeaderboard()

  const cleanName = name.trim().slice(0, 20) || 'Anonymous'
  const nameLower = cleanName.toLowerCase()

  const existingIdx = existing.findIndex(e => e.name.toLowerCase() === nameLower)
  if (existingIdx !== -1 && existing[existingIdx].score >= score) {
    // Player already has equal or better score — no write needed
    return existing
  }

  const entry: LeaderboardEntry = {
    name:  cleanName,
    score,
    date:  new Date().toISOString().slice(0, 10),
  }

  const updated = existing
    .filter(e => e.name.toLowerCase() !== nameLower)
    .concat(entry)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES)

  try {
    await set(ref(db, SCORES_PATH), updated)
    return updated
  } catch {
    return null
  }
}
