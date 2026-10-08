import type { EngKind, EngPracticeConfig, EngQuestion } from '@/core/english/types';

export interface EngAnswerRecord {
  fingerprint: string;
  display: string;
  kind: EngKind;
  userAnswer: string;
  correct: boolean;
  elapsedMs: number;
}

export interface EngSessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  mode: 'normal' | 'mistake';
  config: EngPracticeConfig;
  answers: EngAnswerRecord[];
  totalMs: number;
}

export interface EngMistakeEntry {
  fingerprint: string;
  question: EngQuestion;
  wrongCount: number;
  firstWrongAt: number;
  lastWrongAt: number;
}

export interface EngConfigRecord extends EngPracticeConfig {
  updatedAt: number;
}

export interface EngRepo {
  getConfig(): EngConfigRecord | null;
  saveConfig(c: EngPracticeConfig): void;
  listSessions(): EngSessionRecord[];
  saveSession(s: EngSessionRecord): void;
  listMistakes(): EngMistakeEntry[];
  addMistake(q: EngQuestion, at: number): void;
  removeMistake(fingerprint: string): void;
  getSeenFingerprints(): string[];
  clearEngData(): void;
}

export const ENG_STORAGE_PREFIX = 'xstudy:v1:eng';
export const ENG_MAX_SESSIONS = 200;

const KEYS = {
  config: `${ENG_STORAGE_PREFIX}:config`,
  sessions: `${ENG_STORAGE_PREFIX}:sessions`,
  mistakes: `${ENG_STORAGE_PREFIX}:mistakes`,
} as const;

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

export function createEngRepo(storage: Storage = globalThis.localStorage): EngRepo {
  return {
    getConfig(): EngConfigRecord | null {
      return readJson<EngConfigRecord | null>(storage, KEYS.config, null);
    },
    saveConfig(c: EngPracticeConfig): void {
      writeJson(storage, KEYS.config, { ...c, updatedAt: Date.now() } satisfies EngConfigRecord);
    },
    listSessions(): EngSessionRecord[] {
      const list = readJson<EngSessionRecord[]>(storage, KEYS.sessions, []);
      return [...list].sort((a, b) => b.startedAt - a.startedAt);
    },
    saveSession(s: EngSessionRecord): void {
      const list = readJson<EngSessionRecord[]>(storage, KEYS.sessions, []);
      const next = [s, ...list.filter((x) => x.id !== s.id)].slice(0, ENG_MAX_SESSIONS);
      writeJson(storage, KEYS.sessions, next);
    },
    listMistakes(): EngMistakeEntry[] {
      return readJson<EngMistakeEntry[]>(storage, KEYS.mistakes, []).sort((a, b) => b.lastWrongAt - a.lastWrongAt);
    },
    addMistake(q: EngQuestion, at: number): void {
      const list = readJson<EngMistakeEntry[]>(storage, KEYS.mistakes, []);
      const existing = list.find((m) => m.fingerprint === q.fingerprint);
      if (existing) {
        existing.wrongCount += 1;
        existing.lastWrongAt = at;
      } else {
        list.push({
          fingerprint: q.fingerprint,
          question: q,
          wrongCount: 1,
          firstWrongAt: at,
          lastWrongAt: at,
        });
      }
      writeJson(storage, KEYS.mistakes, list);
    },
    removeMistake(fingerprint: string): void {
      const list = readJson<EngMistakeEntry[]>(storage, KEYS.mistakes, []);
      writeJson(
        storage,
        KEYS.mistakes,
        list.filter((m) => m.fingerprint !== fingerprint),
      );
    },
    getSeenFingerprints(): string[] {
      const seen = new Set<string>();
      for (const s of readJson<EngSessionRecord[]>(storage, KEYS.sessions, [])) {
        for (const a of s.answers) seen.add(a.fingerprint);
      }
      for (const m of readJson<EngMistakeEntry[]>(storage, KEYS.mistakes, [])) {
        seen.add(m.fingerprint);
      }
      return [...seen];
    },
    clearEngData(): void {
      storage.removeItem(KEYS.config);
      storage.removeItem(KEYS.sessions);
      storage.removeItem(KEYS.mistakes);
    },
  };
}
