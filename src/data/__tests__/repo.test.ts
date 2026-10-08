import { beforeEach, describe, expect, it } from 'vitest';
import { createRepo, MAX_SESSIONS, STORAGE_PREFIX } from '../repo';
import type { SessionRecord } from '../repo';
import type { PracticeConfig, Question } from '@/core/types';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

const config: PracticeConfig = {
  operations: ['add'],
  rangeTier: 20,
  questionCount: 10,
  answerMode: 'input',
};

const question = (n: number): Question => ({
  fingerprint: `add:${n}+1=?`,
  type: 'add',
  display: `${n} + 1 = ?`,
  answer: n + 1,
  answerText: String(n + 1),
  hint: 'h',
});

const session = (id: string, startedAt: number): SessionRecord => ({
  id,
  startedAt,
  endedAt: startedAt + 1000,
  mode: 'normal',
  config,
  answers: [
    { fingerprint: 'add:1+1=?', display: '1 + 1 = ?', type: 'add', userAnswer: '2', correct: true, elapsedMs: 100 },
  ],
  totalMs: 100,
});

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe('配置持久化', () => {
  it('保存后可读回', () => {
    const repo = createRepo(storage);
    expect(repo.getConfig()).toBeNull();
    repo.saveConfig(config);
    const loaded = repo.getConfig();
    expect(loaded).toMatchObject(config);
    expect(typeof loaded?.updatedAt).toBe('number');
  });
});

describe('会话持久化', () => {
  it('保存与列出（最新在前）', () => {
    const repo = createRepo(storage);
    repo.saveSession(session('a', 100));
    repo.saveSession(session('b', 200));
    const list = repo.listSessions();
    expect(list.map((s) => s.id)).toEqual(['b', 'a']);
  });
  it('同 id 去重更新', () => {
    const repo = createRepo(storage);
    repo.saveSession(session('a', 100));
    repo.saveSession({ ...session('a', 100), totalMs: 999 });
    const list = repo.listSessions();
    expect(list).toHaveLength(1);
    expect(list[0]?.totalMs).toBe(999);
  });
  it(`超过 ${MAX_SESSIONS} 条时裁剪最旧`, () => {
    const repo = createRepo(storage);
    for (let i = 0; i < MAX_SESSIONS + 10; i += 1) repo.saveSession(session(`s${i}`, i));
    const list = repo.listSessions();
    expect(list).toHaveLength(MAX_SESSIONS);
    expect(list[list.length - 1]?.id).toBe('s10');
  });
});

describe('易错收藏 (FR-MATH-13 / Q-10)', () => {
  it('首次答错入库，再次答错累计次数', () => {
    const repo = createRepo(storage);
    repo.addMistake(question(5), 1000);
    repo.addMistake(question(5), 2000);
    const list = repo.listMistakes();
    expect(list).toHaveLength(1);
    expect(list[0]?.wrongCount).toBe(2);
    expect(list[0]?.firstWrongAt).toBe(1000);
    expect(list[0]?.lastWrongAt).toBe(2000);
  });
  it('按指纹去重，不同题各存一条', () => {
    const repo = createRepo(storage);
    repo.addMistake(question(5), 1);
    repo.addMistake(question(6), 2);
    expect(repo.listMistakes()).toHaveLength(2);
  });
  it('可手动移除', () => {
    const repo = createRepo(storage);
    repo.addMistake(question(5), 1);
    repo.removeMistake(question(5).fingerprint);
    expect(repo.listMistakes()).toHaveLength(0);
  });
  it('最新错题排前', () => {
    const repo = createRepo(storage);
    repo.addMistake(question(5), 1000);
    repo.addMistake(question(6), 2000);
    expect(repo.listMistakes().map((m) => m.fingerprint)).toEqual([question(6).fingerprint, question(5).fingerprint]);
  });
});

describe('跨练习指纹 (Q-11)', () => {
  it('汇总历史会话与错题的指纹', () => {
    const repo = createRepo(storage);
    repo.saveSession(session('a', 100));
    repo.addMistake(question(5), 1);
    const seen = repo.getSeenFingerprints();
    expect(seen).toContain('add:1+1=?');
    expect(seen).toContain(question(5).fingerprint);
  });
});

describe('clearAll (Q-13)', () => {
  it('清空全部三类数据', () => {
    const repo = createRepo(storage);
    repo.saveConfig(config);
    repo.saveSession(session('a', 1));
    repo.addMistake(question(5), 1);
    repo.clearAll();
    expect(repo.getConfig()).toBeNull();
    expect(repo.listSessions()).toHaveLength(0);
    expect(repo.listMistakes()).toHaveLength(0);
    expect(storage.getItem(`${STORAGE_PREFIX}:config`)).toBeNull();
  });
});

describe('容错', () => {
  it('损坏 JSON 时回退默认值', () => {
    storage.setItem(`${STORAGE_PREFIX}:sessions`, '{broken');
    const repo = createRepo(storage);
    expect(repo.listSessions()).toEqual([]);
  });
});
