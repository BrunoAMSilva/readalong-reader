// readalong-reader — TTS engine contract
// Copyright (C) 2026 Bruno Silva
// Licensed under the GNU GPL v3.0 or later. See LICENSE.

/**
 * A single unit of speech the reader hands to an engine.
 * @typedef {Object} Utterance
 * @property {string} text  Plain text of the sentence/heading.
 * @property {{text:string,len:number}[]} words  The word tokens, in order.
 */

/**
 * @typedef {Object} SpeakOptions
 * @property {string}  [voice]                 Engine-specific voice id.
 * @property {number}  [rate]                  Playback rate (1 = normal).
 * @property {(wordIndex:number)=>void} [onWord]  Highlight word N (or -1 to clear).
 * @property {()=>void} [onEnd]                Called once when the utterance finishes.
 * @property {(err:Error)=>void} [onError]     Called on failure.
 * @property {()=>boolean} [cancelled]         Returns true if the reader has moved on.
 */

/**
 * @typedef {Object} VoiceInfo
 * @property {string} id
 * @property {string} label
 */

/**
 * Base class / interface every TTS engine implements.
 * Engines are responsible for driving word highlighting (via onWord) and
 * signalling completion (onEnd). The reader owns sentence sequencing.
 * @abstract
 */
export class TTSEngine {
  /** Stable identifier, e.g. "system" or "kokoro". @returns {string} */
  get id() { return 'base'; }

  /** True when the engine reports exact per-word boundaries (vs. estimated). @returns {boolean} */
  get exactWordTiming() { return false; }

  /** @returns {Promise<VoiceInfo[]>} */
  async listVoices() { return []; }

  /**
   * Preload any heavy resources (models, audio graph). Safe to call repeatedly.
   * @param {(p:{status:string, progress:number})=>void} [onProgress]
   * @returns {Promise<void>}
   */
  async prepare(onProgress) {}

  /**
   * Optionally pre-generate audio for an upcoming utterance. No-op by default.
   * @param {Utterance} _utterance
   * @param {SpeakOptions} [_opts]
   */
  prefetch(_utterance, _opts) {}

  /**
   * Speak one utterance. Must eventually invoke opts.onEnd() or opts.onError().
   * @param {Utterance} _utterance
   * @param {SpeakOptions} [_opts]
   */
  speak(_utterance, _opts) { throw new Error('TTSEngine.speak() not implemented'); }

  /** Pause current playback (resumable). */
  pause() {}

  /** Resume after pause(). */
  resume() {}

  /** Stop immediately and invalidate any in-flight callbacks. */
  stop() {}

  /** Release all resources. */
  dispose() {}
}
