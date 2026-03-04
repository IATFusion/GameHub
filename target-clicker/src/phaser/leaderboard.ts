/**
 * leaderboard.ts
 *
 * Global leaderboard backed by JSONBin.io – a free hosted JSON store.
 * No database, no server code required.
 *
 * ─── SETUP (one time, ~2 min) ────────────────────────────────────────────────
 *  1. Go to https://jsonbin.io and create a free account.
 *  2. In the dashboard click "CREATE BIN", paste this as initial content:
 *       {"scores":[]}
 *     and save. Copy the Bin ID from the URL (looks like: 6615f9abc4…).
 *  3. Under "API Keys" generate a new key. Copy it.
 *  4. Paste both values into the two constants below.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const JSONBIN_BIN_ID  = '69a6d34243b1c97be9af1b59'
const JSONBIN_API_KEY = '$2a$10$9zm9qsJ9/Ra.issqEzVBnu0tj5gAcDix07a20p9X2bCTGkQRrljGC'

const BASE_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`
const HEADERS  = {
  'Content-Type': 'application/json',
  'X-Master-Key': JSONBIN_API_KEY,
  'X-Bin-Versioning': 'false', // keep single latest version – no history noise
}

/** Maximum entries kept in the leaderboard. */
const MAX_ENTRIES = 10

export interface LeaderboardEntry {
  name:  string
  score: number
  date:  string // ISO date string (date only, not time)
}

/** Returns true when credentials have been filled in. */
export function leaderboardConfigured(): boolean {
  return (
    true
  )
}

/** Fetch the current top-10 from JSONBin. Falls back to [] on error. */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!leaderboardConfigured()) return []
  try {
    const res = await fetch(`${BASE_URL}/latest`, { headers: HEADERS })
    if (!res.ok) return []
    const json = await res.json() as { record?: { scores?: LeaderboardEntry[] } }
    return json.record?.scores ?? []
  } catch {
    return []
  }
}

/**
 * Submit a new score. Each player gets exactly one slot (their personal best).
 * If an entry with the same name already exists:
 *   - new score is higher  → replace the entry
 *   - new score is equal or lower → leave the board unchanged, return it as-is
 * Returns the updated board, or null on failure.
 */
export async function submitScore(
  name:  string,
  score: number,
): Promise<LeaderboardEntry[] | null> {
  if (!leaderboardConfigured()) return null

  const existing = await fetchLeaderboard()

  const cleanName = name.trim().slice(0, 20) || 'Anonymous'
  const nameLower  = cleanName.toLowerCase()

  // Find existing entry for this player (case-insensitive)
  const existingIdx = existing.findIndex(e => e.name.toLowerCase() === nameLower)

  if (existingIdx !== -1 && existing[existingIdx].score >= score) {
    // Player already has an equal or better score — nothing to update
    return existing
  }

  const entry: LeaderboardEntry = {
    name:  cleanName,
    score,
    date:  new Date().toISOString().slice(0, 10),
  }

  // Remove any previous entry for this player, then insert the new best
  const updated = existing
    .filter(e => e.name.toLowerCase() !== nameLower)
    .concat(entry)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES)

  try {
    const res = await fetch(BASE_URL, {
      method:  'PUT',
      headers: HEADERS,
      body:    JSON.stringify({ scores: updated }),
    })
    if (!res.ok) return null
    return updated
  } catch {
    return null
  }
}
