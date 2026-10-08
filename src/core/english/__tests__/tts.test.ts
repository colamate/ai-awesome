import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { audioFileFor, cancelSpeak, speak } from '../tts';

interface RawWords {
  english?: {
    grades?: Array<{
      volumes?: Array<{
        units?: Array<{
          words?: Array<{ en?: unknown }>;
          sentences?: Array<{ en?: unknown }>;
        }>;
      }>;
    }>;
  };
}

const ROOT = path.resolve(__dirname, '../../../..');
const manifestPath = path.join(ROOT, 'data/tts-manifest.json');
const manifest = JSON.parse(
  readFileSync(manifestPath, 'utf8'),
) as Record<string, string>;

describe('tts manifest', () => {
  it('covers every raw en string in textbooks.json with an existing audio file', () => {
    const raw = JSON.parse(
      readFileSync(path.join(ROOT, 'data/textbooks.json'), 'utf8'),
    ) as RawWords;
    const expected = new Set<string>();
    for (const grade of raw.english?.grades ?? []) {
      for (const volume of grade.volumes ?? []) {
        for (const unit of volume.units ?? []) {
          for (const item of [...(unit.words ?? []), ...(unit.sentences ?? [])]) {
            if (typeof item.en === 'string' && item.en.trim() !== '') {
              expected.add(item.en);
            }
          }
        }
      }
    }
    expect(expected.size).toBeGreaterThan(500);
    for (const text of expected) {
      expect(audioFileFor(text), `missing audio for: ${text}`).toBeDefined();
      const file = audioFileFor(text);
      expect(file).toMatch(/^[0-9a-f]{16}\.mp3$/);
      expect(
        existsSync(path.join(ROOT, 'public/audio', file ?? '')),
        `audio file not on disk: ${file}`,
      ).toBe(true);
    }
  });

  it('maps known utterances to audio files', () => {
    expect(manifest.hello).toMatch(/^[0-9a-f]{16}\.mp3$/);
    expect(audioFileFor('hello')).toBe(manifest.hello);
    expect(audioFileFor("let's=let us")).toMatch(/\.mp3$/);
  });

  it('returns undefined for text outside the manifest', () => {
    expect(audioFileFor('not in the textbook corpus')).toBeUndefined();
  });
});

describe('speak', () => {
  it('resolves immediately for empty text', async () => {
    await expect(speak('')).resolves.toBeUndefined();
  });

  it('resolves in jsdom for manifest-hit, miss, and unknown text', async () => {
    await expect(speak('hello')).resolves.toBeUndefined();
    await expect(speak('not in the textbook corpus')).resolves.toBeUndefined();
    await expect(speak('-What\'s this? -It\'s a book.')).resolves.toBeUndefined();
  });

  it('resolves with rate option', async () => {
    await expect(speak('hello', { rate: 0.6 })).resolves.toBeUndefined();
  });

  it('cancelSpeak does not throw and resolves pending speak', async () => {
    const pending = speak('hello');
    expect(() => cancelSpeak()).not.toThrow();
    await expect(pending).resolves.toBeUndefined();
    expect(() => cancelSpeak()).not.toThrow();
  });
});
