// readalong-reader — public entry point
// Copyright (C) 2026 Bruno Silva
// Licensed under the GNU GPL v3.0 or later. See LICENSE.
//
// Importing this module registers the <read-along-reader> custom element
// (side effect). Named exports are provided for advanced/programmatic use.

import { ReadAlongReader, defineReadAlongReader } from './reader.js';

export { ReadAlongReader, defineReadAlongReader } from './reader.js';
export { TTSEngine } from './engines/base.js';
export { SystemEngine } from './engines/system-engine.js';
export { KokoroEngine } from './engines/kokoro-engine.js';
export { splitSentences, parseMarkdown, parsePasted, stripInline } from './parse.js';

// Auto-register on import.
defineReadAlongReader();

export default ReadAlongReader;
