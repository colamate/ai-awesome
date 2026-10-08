import { describe, expect, it } from 'vitest';
import { createEngRepo, ENG_MAX_SESSIONS, type EngSessionRecord } from '../englishRepo';
import type { EngPracticeConfig, EngQuestion } from '@/core/english/types';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

const config: EngPracticeConfig = {
  kind: 'word',
  filter: { grades: [1], volumes: [], units: [] },
  wordMode: 'en2zh',
  answerMode: 'choice4',
  questionCount: 10,
};

function question(fingerprint: string): EngQuestion {
  return {
    fingerprint,
    kind: 'word',
    display: 'cat',
    answer: '猫',
    answerDisplay: { en: 'cat', zh: '猫' },
    hint: '',
  };
}

function session(id: string, startedAt: number, fps: string[] = []): EngSessionRecord {
  return {
    id,
    startedAt,
    endedAt: startedAt + 1000,
    mode: 'normal',
    config,
    answers: fps.map((f) => ({
      fingerprint: f,
      display: 'cat',
      kind: 'word' as const,
      userAnswer: '猫',
      correct: true,
      elapsedMs: 100,
    })),
    totalMs: 1000,
  };
}

describe('createEngRepo', () => {
  it('round-trips config with updatedAt', () => {
    const repo = createEngRepo(fakeStorage());
    expect(repo.getConfig()).toBeNull();
    repo.saveConfig(config);
    const saved = repo.getConfig();
    expect(saved?.wordMode).toBe('en2zh');
    expect(saved?.updatedAt).toBeTypeOf('number');
  });

  it('stores sessions newest first and caps at the limit', () => {
    const repo = createEngRepo(fakeStorage());
    repo.saveSession(session('a', 100));
    repo.saveSession(session('b', 200));
    expect(repo.listSessions().map((s) => s.id)).toEqual(['b', 'a']);
    for (let i = 0; i < ENG_MAX_SESSIONS + 10; i++) {
      repo.saveSession(session(`s${i}`, 1000 + i));
    }
    expect(repo.listSessions()).toHaveLength(ENG_MAX_SESSIONS);
  });

  it('accumulates wrongCount for repeated mistakes', () => {
    const repo = createEngRepo(fakeStorage());
    repo.addMistake(question('fp1'), 1);
    repo.addMistake(question('fp1'), 2);
    repo.addMistake(question('fp2'), 3);
    const list = repo.listMistakes();
    expect(list).toHaveLength(2);
    expect(list.find((m) => m.fingerprint === 'fp1')?.wrongCount).toBe(2);
    expect(list.find((m) => m.fingerprint === 'fp2')?.wrongCount).toBe(1);
  });

  it('removes a mistake by fingerprint', () => {
    const repo = createEngRepo(fakeStorage());
    repo.addMistake(question('fp1'), 1);
    repo.removeMistake('fp1');
    expect(repo.listMistakes()).toHaveLength(0);
  });

  it('collects seen fingerprints from sessions and mistakes', () => {
    const repo = createEngRepo(fakeStorage());
    repo.saveSession(session('a', 1, ['f1', 'f2']));
    repo.addMistake(question('f3'), 5);
    const seen = repo.getSeenFingerprints();
    expect(seen).toContain('f1');
    expect(seen).toContain('f2');
    expect(seen).toContain('f3');
  });

  it('namespaces keys separately from math storage', () => {
    const storage = fakeStorage();
    storage.setItem('xstudy:v1:mistakes', '[{"fingerprint":"math"}]');
    const repo = createEngRepo(storage);
    repo.addMistake(question('eng1'), 1);
    expect(repo.getSeenFingerprints()).toEqual(['eng1']);
    expect(storage.getItem('xstudy:v1:mistakes')).toBe('[{"fingerprint":"math"}]');
  });

  it('clears only english data', () => {
    const storage = fakeStorage();
    storage.setItem('xstudy:v1:mistakes', '["math"]');
    const repo = createEngRepo(storage);
    repo.saveConfig(config);
    repo.addMistake(question('fp'), 1);
    repo.clearEngData();
    expect(repo.getConfig()).toBeNull();
    expect(repo.listMistakes()).toHaveLength(0);
    expect(storage.getItem('xstudy:v1:mistakes')).toBe('["math"]');
  });
});
