# GitHub Copilot Instructions

These instructions define how GitHub Copilot should assist with the SyncSong project. The goal is to ensure consistent, high-quality code generation aligned with our conventions, stack, and best practices.

## 🧠 Context

- **Project Type**: Single-page web application (PWA)
- **Language**: JavaScript (ES Modules)
- **Framework / Libraries**: Vanilla JS, Vite, Tailwind CSS, WaveSurfer.js, music-metadata
- **Architecture**: Class-based modules with pure utility functions

## 🔧 General Guidelines

- Use JavaScript-idiomatic patterns with ES modules (`import`/`export`).
- Prefer named functions and avoid long anonymous closures.
- Add JSDoc comments for public methods and complex logic.
- Prefer readability over cleverness.
- Keep the codebase lightweight - no heavy frameworks.

## 📁 File Structure

Use this structure as a guide when creating or updating files:

```text
src/
  main.js           # Entry point, initializes app
  style.css         # Tailwind imports + custom component classes
  lrc-parser.js     # Pure functions for LRC parsing/serialization
  audio-player.js   # AudioPlayer class - waveform and playback
  editor.js         # LyricEditor class - lyrics state management
  ui.js             # UI class - DOM manipulation and event handlers
public/
  pwa/              # PWA icons
  splitwave.svg     # App logo
  social-card.png   # Open Graph image
test/
  data/             # Test audio and LRC files
```

## 🧶 Patterns

### ✅ Patterns to Follow

- Use classes for stateful components (AudioPlayer, LyricEditor, UI).
- Use pure functions for utilities (lrc-parser.js).
- Use callbacks instead of EventEmitter for inter-class communication.
- For UI:
  - Use Tailwind utility classes in HTML.
  - Custom component styles go in `@layer components` in style.css.
  - Dark theme by default (slate color palette).
  - Use `primary-*` color scale for accent colors (indigo-based).
- All file handling happens client-side - never upload user files.
- Use async/await for asynchronous operations.

### 🚫 Patterns to Avoid

- Don't add heavy frameworks or dependencies unless absolutely necessary.
- Don't hardcode values; use constants or config objects.
- Don't expose API keys or secrets in client-side code.
- Avoid global state; encapsulate state in class instances.
- Don't use inline styles; prefer Tailwind classes.

## 🧪 Testing Guidelines

- Test files are available under `test/data/` for manual Playwright testing.
- When modifying LRC parsing logic, verify with existing test LRC files.

## 🧩 Example Prompts

- `Copilot, add a new metadata field to the LRC parser for the 'length' tag.`
- `Copilot, implement keyboard shortcuts for skipping forward/backward 5 seconds.`
- `Copilot, create a Tailwind component class for a modal dialog.`
- `Copilot, add a method to LyricEditor that inserts a new line at the current timestamp.`

## 🔁 Iteration & Review

- Copilot output should be reviewed and modified before committing.
- If code isn't following these instructions, regenerate with more context or split the task.
- Use comments to clarify intent before invoking Copilot.

## 📚 References

- [MDN JavaScript Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference)
- [Vite Documentation](https://vite.dev/guide/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [WaveSurfer.js Documentation](https://wavesurfer.xyz/docs/)
- [music-metadata Documentation](https://github.com/borewit/music-metadata)
- [LRC File Format](https://en.wikipedia.org/wiki/LRC_(file_format))
- [LRCLIB API Documentation](https://lrclib.net/docs)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API)
