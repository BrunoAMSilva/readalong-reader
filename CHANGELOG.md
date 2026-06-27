# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/).

## [0.4.2] — 2026-06-24

### Performance
- Smoother Kokoro playback: the reader now buffers several sentences ahead
  (`PREFETCH_AHEAD = 3`) and generation is serialized onto a single queue (the
  ONNX model is one session, so concurrent calls were unsafe/slower). The next
  clip is ready when the current finishes, removing the long pause between
  phrases. First sentence still has a one-time warm-up while it generates.

## [0.4.1] — 2026-06-24

### Fixed
- Kokoro engine could be created with the default `'kokoro-js'` specifier if the
  `engine` attribute was set before `kokoro-module` (the `engine` attribute is
  no longer acted on until the element is connected, by which point all
  attributes are present). Also recreate the cached engine if `kokoro-module`
  changes. Fixes "Failed to resolve module specifier 'kokoro-js'".
- The natural-voice fallback now reports the underlying error in the status bar
  and console instead of a generic message.

## [0.4.0] — 2026-06-24

Full Markdown compliance, inline formatting, and real heading levels.

### Added
- `parseMarkdown` now uses [marked](https://marked.js.org) (CommonMark + GFM), so
  emphasis, links, inline code, strikethrough, nested lists, tables, autolinks,
  and more are parsed correctly. `marked` is a dependency (used only by the
  Markdown path; the TTS/render core stays dependency-free).
- **Inline formatting is preserved** on spoken blocks: bold, italic, links,
  inline code, etc. render as real elements while words remain individually
  highlightable. Text blocks now accept `{ html }` as well as a plain string.
- **Heading levels** — new `{ heading: { level, text|html } }` block renders
  `<h1>`–`<h6>`. (`{ h2 }` still works as a legacy shorthand.)
- New `{ hr }` and `{ rawHtml }` blocks; raw HTML is block-sanitized.

### Security
- All HTML (from Markdown or extracted articles) is sanitized against an
  allowlist of safe tags/attributes; scripts, event handlers, and `javascript:`
  URLs are stripped. Links open with `rel="noopener noreferrer"`.

### Changed
- Headings render their text inside a sentence span (focus dimming now keys off
  `.sent`), so all heading levels dim/highlight consistently.

## [0.3.0] — 2026-06-24

Rich content. The reader now renders more than headings and paragraphs.

### Added
- New block types in the doc model: `quote`, `code`, `list` (`{ordered, items}`),
  `img` (`{src, alt, caption}`), `video` (`{src, poster, caption}`), `embed`
  (`{url, provider, title, caption}`, click-to-load in a sandboxed iframe), and
  `table` (`{rows}`). Backward compatible — existing `{p}` / `{h2}` docs are unchanged.
- Spoken vs. visual: text blocks (paragraphs, headings, quotes, list items) are
  read aloud and highlighted; images, video, embeds, code, and tables are rendered
  but not narrated.
- `parseMarkdown` now emits images, lists, blockquotes, and fenced code blocks.
- Styles for all new elements; embeds are click-to-load (no autoplay/trackers).

## [0.2.1] — 2026-06-24

Decoupled content input from the component. The reader now makes **zero network
calls** and has no opinion about where content comes from.

### Changed (breaking)
- Input is layered: `loadDoc(doc)` is the primitive; `loadMarkdown(md)` is the
  recommended default; `loadText(text)` handles plain text; `load(input)`
  auto-detects. New `markdown` property/attribute.
- Removed `loadURL()` and the `fetchReadable()` helper, plus the `src` and
  `reader-service` attributes and the URL field in the UI. Fetching is now the
  caller's responsibility — see the "Bring your own content" recipe in the README.

## [0.1.0] — 2026-06-24

Initial public release.

### Added
- `<read-along-reader>` web component with synchronized **sentence + word** highlighting.
- Pluggable TTS engines:
  - **SystemEngine** — zero-dependency Web Speech API voice with exact word boundaries.
  - **KokoroEngine** — natural neural voice running 100% on-device via the optional
    `kokoro-js` peer dependency (WebGPU with WASM fallback). Word highlighting is
    synced to the audio clock.
- Accessibility-first UI: dark / sepia / high-contrast themes, focus dimming,
  adjustable text size, line spacing and speed, keyboard control, ARIA roles,
  `aria-current` on the active sentence, and `prefers-reduced-motion` support.
- Load content from a URL (via a readability service), pasted text, Markdown,
  or a structured doc object.
- TypeScript definitions and `rar:*` custom events.
