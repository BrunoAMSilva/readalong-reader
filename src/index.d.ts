// Type definitions for readalong-reader
// Licensed under the GNU GPL v3.0 or later.

/** A text value: plain string or sanitized inline HTML. */
export type InlineText = string | { html: string };

export type ReaderBlock =
  | { p: InlineText }
  | { heading: { level: number; text?: string; html?: string } }
  | { h2: string }                       // legacy shorthand for a level-2 heading
  | { quote: InlineText }
  | { code: string; lang?: string }
  | { hr: true }
  | { rawHtml: string }
  | { list: { ordered?: boolean; items: InlineText[] } }
  | { img: { src: string; alt?: string; caption?: string } }
  | { video: { src: string; poster?: string; caption?: string } }
  | { embed: { url: string; provider?: string; title?: string; caption?: string } }
  | { table: { rows: string[][] } };

export interface ReaderDoc {
  eyebrow: string | null;
  title: string | null;
  blocks: ReaderBlock[];
}

export interface Utterance {
  text: string;
  words: Array<{ text: string; len: number }>;
}

export interface VoiceInfo { id: string; label: string; }

export interface SpeakOptions {
  voice?: string;
  rate?: number;
  onWord?: (wordIndex: number) => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
  cancelled?: () => boolean;
}

export abstract class TTSEngine {
  readonly id: string;
  readonly exactWordTiming: boolean;
  listVoices(): Promise<VoiceInfo[]>;
  prepare(onProgress?: (p: { status: string; progress: number }) => void): Promise<void>;
  prefetch(utterance: Utterance, opts?: SpeakOptions): void;
  speak(utterance: Utterance, opts?: SpeakOptions): void;
  pause(): void;
  resume(): void;
  stop(): void;
  dispose(): void;
}

export class SystemEngine extends TTSEngine {
  defaultVoice(): string | null;
}

export interface KokoroEngineOptions {
  model?: string;
  module?: string;
  voice?: string;
  dtype?: 'fp32' | 'fp16' | 'q8';
}
export class KokoroEngine extends TTSEngine {
  constructor(opts?: KokoroEngineOptions);
  defaultVoice(): string;
  setVoice(v: string): void;
}

export class ReadAlongReader extends HTMLElement {
  engine: 'system' | 'kokoro';
  /** Get/set Markdown content. */
  markdown: string;
  sentences: Array<{ el: HTMLElement; words: HTMLElement[]; text: string }>;
  current: number;
  state: 'idle' | 'playing' | 'paused';
  /** Load a normalized doc directly (the primitive). */
  loadDoc(doc: ReaderDoc): void;
  /** Load Markdown (recommended input). */
  loadMarkdown(md: string): void;
  /** Load plain text (heuristic headings). */
  loadText(text: string): void;
  /** Auto-detect: doc object, Markdown, or plain text. */
  load(input: ReaderDoc | string): void;
  play(): void;
  pause(): void;
  toggle(): void;
  stop(): void;
  restart(): void;
  startFrom(i: number): void;
}

export function defineReadAlongReader(tag?: string): typeof ReadAlongReader;

export function splitSentences(text: string): string[];
export function parseMarkdown(md: string): ReaderDoc;
export function parsePasted(raw: string): ReaderDoc;
export function stripInline(s: string): string;

export default ReadAlongReader;
