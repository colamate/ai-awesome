/** TTS 封装 (D4 修订): 预生成标准音频 data/tts-manifest.json → public/audio/ 优先，Web Speech API 兜底 */

import ttsManifest from '../../../data/tts-manifest.json';

export interface SpeakOptions {
  rate?: number;
  lang?: string;
}

const SPEECH_SAFETY_TIMEOUT_MS = 15_000;
const AUDIO_SAFETY_TIMEOUT_MS = 30_000;
const AUDIO_MANIFEST = ttsManifest as Record<string, string>;

let audio: HTMLAudioElement | null = null;
let audioDone: (() => void) | null = null;

/** jsdom/happy-dom 无真实媒体播放，跳过音频路径直接走 Web Speech 兜底 */
function audioSupported(): boolean {
  if (typeof Audio === 'undefined') return false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return !ua.includes('jsdom') && !ua.includes('happy-dom');
}

/** 文本 → 预生成音频文件名；未收录文本返回 undefined */
export function audioFileFor(text: string): string | undefined {
  return AUDIO_MANIFEST[text];
}

export function isTtsSupported(): boolean {
  return (
    audioSupported() ||
    (typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis)
  );
}

function stopAudio(): void {
  if (audio !== null) {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio = null;
  }
  if (audioDone !== null) {
    const done = audioDone;
    audioDone = null;
    done();
  }
}

/** 播放预生成音频；文件缺失/播放被拒时退回 Web Speech */
function playAudioFile(
  file: string,
  text: string,
  opts: SpeakOptions,
): Promise<void> {
  try {
    const el = new Audio(`/audio/${file}`);
    el.playbackRate = opts.rate ?? 0.9;
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = (fallback: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (audio === el) {
          audio = null;
          audioDone = null;
        }
        if (fallback) resolve(speakWebSpeech(text, opts));
        else resolve();
      };
      const timer = setTimeout(() => done(false), AUDIO_SAFETY_TIMEOUT_MS);
      el.onended = () => done(false);
      el.onerror = () => done(true);
      audio = el;
      audioDone = () => done(false);
      const p = el.play();
      if (p === undefined || typeof p.then !== 'function') done(true);
      else p.catch(() => done(true));
    });
  } catch {
    return speakWebSpeech(text, opts);
  }
}

function speakWebSpeech(text: string, opts: SpeakOptions): Promise<void> {
  if (
    typeof globalThis === 'undefined' ||
    !('speechSynthesis' in globalThis)
  ) {
    return Promise.resolve();
  }
  const synth = globalThis.speechSynthesis;
  try {
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = opts.rate ?? 0.9;
    utter.lang = opts.lang ?? 'en-US';
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, SPEECH_SAFETY_TIMEOUT_MS);
      utter.onend = done;
      utter.onerror = done;
      synth.speak(utter);
    });
  } catch {
    return Promise.resolve();
  }
}

/**
 * 朗读文本。预生成音频命中则播放音频，否则 Web Speech 兜底；
 * 新调用先取消旧的，避免排队叠音 (D4)。
 * 不支持 TTS / 出错 / 超时均 resolve，永不 reject（UI 不必 try/catch）。
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (text === '') return Promise.resolve();
  cancelSpeak();
  const file = AUDIO_MANIFEST[text];
  if (file !== undefined && audioSupported()) {
    return playAudioFile(file, text, opts);
  }
  return speakWebSpeech(text, opts);
}

/** 取消当前朗读（音频与 Web Speech 同时停止） */
export function cancelSpeak(): void {
  stopAudio();
  if (typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis) {
    try {
      globalThis.speechSynthesis.cancel();
    } catch {
      /* speechSynthesis 不可用时静默 */
    }
  }
}
