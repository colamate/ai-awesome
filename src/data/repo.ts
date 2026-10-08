import type { PracticeConfig, Question } from '@/core/types';

export interface AnswerRecord {
  fingerprint: string;
  display: string;
  type: Question['type'];
  userAnswer: string;
  correct: boolean;
  elapsedMs: number;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  mode: 'normal' | 'mistake';
  config: PracticeConfig;
  answers: AnswerRecord[];
  /** 有效作答总时长（暂停区间已扣除，Q-09） */
  totalMs: number;
}

export interface MistakeEntry {
  fingerprint: string;
  question: Question;
  wrongCount: number;
  firstWrongAt: number;
  lastWrongAt: number;
}

export interface ConfigRecord extends PracticeConfig {
  updatedAt: number;
}

export interface Repo {
  getConfig(): ConfigRecord | null;
  saveConfig(c: PracticeConfig): void;
  listSessions(): SessionRecord[];
  saveSession(s: SessionRecord): void;
  listMistakes(): MistakeEntry[];
  addMistake(q: Question, at: number): void;
  removeMistake(fingerprint: string): void;
  getSeenFingerprints(): string[];
  clearAll(): void;
}

export const STORAGE_PREFIX = 'xstudy:v1';
export const MAX_SESSIONS = 200;

const KEYS = {
  config: `${STORAGE_PREFIX}:config`,
  sessions: `${STORAGE_PREFIX}:sessions`,
  mistakes: `${STORAGE_PREFIX}:mistakes`,
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

/** 创建本地持久化仓库；可注入 Storage 以便测试 (§2.2 契约) */
export function createRepo(storage: Storage = globalThis.localStorage): Repo {
  return {
    getConfig(): ConfigRecord | null {
      return readJson<ConfigRecord | null>(storage, KEYS.config, null);
    },
    saveConfig(c: PracticeConfig): void {
      writeJson(storage, KEYS.config, { ...c, updatedAt: Date.now() } satisfies ConfigRecord);
    },
    listSessions(): SessionRecord[] {
      const list = readJson<SessionRecord[]>(storage, KEYS.sessions, []);
      return [...list].sort((a, b) => b.startedAt - a.startedAt);
    },
    saveSession(s: SessionRecord): void {
      const list = readJson<SessionRecord[]>(storage, KEYS.sessions, []);
      const next = [s, ...list.filter((x) => x.id !== s.id)].slice(0, MAX_SESSIONS);
      writeJson(storage, KEYS.sessions, next);
    },
    listMistakes(): MistakeEntry[] {
      return readJson<MistakeEntry[]>(storage, KEYS.mistakes, []).sort((a, b) => b.lastWrongAt - a.lastWrongAt);
    },
    addMistake(q: Question, at: number): void {
      const list = readJson<MistakeEntry[]>(storage, KEYS.mistakes, []);
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
      const list = readJson<MistakeEntry[]>(storage, KEYS.mistakes, []);
      writeJson(
        storage,
        KEYS.mistakes,
        list.filter((m) => m.fingerprint !== fingerprint),
      );
    },
    getSeenFingerprints(): string[] {
      const seen = new Set<string>();
      for (const s of readJson<SessionRecord[]>(storage, KEYS.sessions, [])) {
        for (const a of s.answers) seen.add(a.fingerprint);
      }
      for (const m of readJson<MistakeEntry[]>(storage, KEYS.mistakes, [])) {
        seen.add(m.fingerprint);
      }
      return [...seen];
    },
    clearAll(): void {
      storage.removeItem(KEYS.config);
      storage.removeItem(KEYS.sessions);
      storage.removeItem(KEYS.mistakes);
    },
  };
}
