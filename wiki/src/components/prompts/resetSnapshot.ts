const PREFIX = "robin:prompt-reset-undo:";
const TTL_MS = 10 * 60 * 1000; // 10 minutes per locked decision #9

export interface ResetSnapshot {
  yaml: string;
  takenAt: number;
}

function key(slug: string): string {
  return `${PREFIX}${slug}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function saveSnapshot(slug: string, yaml: string): void {
  if (!isBrowser()) return;
  const snap: ResetSnapshot = { yaml, takenAt: Date.now() };
  try {
    window.sessionStorage.setItem(key(slug), JSON.stringify(snap));
  } catch {
    // sessionStorage can throw in private-browsing or when quota exceeded. Silent.
  }
}

export function readSnapshot(slug: string): ResetSnapshot | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(key(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResetSnapshot;
    if (typeof parsed?.yaml !== "string" || typeof parsed?.takenAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.takenAt > TTL_MS) {
      clearSnapshot(slug);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSnapshot(slug: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(key(slug));
  } catch {
    /* noop */
  }
}

export const RESET_SNAPSHOT_TTL_MS = TTL_MS;
