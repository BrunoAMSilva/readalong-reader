# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-06-24

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
