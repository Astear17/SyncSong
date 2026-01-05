# LRC Editor

## Overview

The LRC file format is commonly used for displaying synced lyrics with music.
Each line of lyrics is prefixed with a timestamp which controls when the line is
displayed by any application with support for synced lyrics.

However, the timestamps in LRC files are often slightly out of sync for a variety
of reasons and it can be very difficult and time consuming to adjust the
timestamps.

The LRC Editor is a web app and single-page application which makes it super
simple to edit LRC files. The user is able to copy and paste the contents of an
LRC file, or drag and drop an LRC file into the browser, or even copy unsynced
lyrics into the page.

Then the user can drag and drop a music file in any popular format (mp3, flac,
ogg, m4a). If the lyrics are unsynced (they do not include timestamps on each
line of lyrics), then the lines of unsynced lyrics will be timestamped by splitting
the length of the song by the number of lines of lyrics, and assigning evenly
distributed timestamps that the user can adjust later.

The web interface then provides simple controls for adjusting lyric timestamps
while the music is playing. If the user scrolls the mousewheel up, or presses the
up or left arrows on the keyboard, the current line of lyrics is adjusted up in
increments of 1/10th of a second. When an adjustment is made, the song playback
jumps to the exact timestamp of the adjusted line so the user can listen and adjust
again if needed. When the user scrolls the mousewheel down, or presses the down or
right arrow keys, the timestamp for that line of lyrics is increased in increments
of 1/10th of a second.

During playback, the selected line automatically follows the currently playing
lyric so that keyboard/mouse adjustments always apply to the line being heard.

If the LRC file includes metadata for the artist, album, and track name, those
fields are detected and can be easily adjusted by the user. When they are finished,
they can copy the LRC file contents, or download the updated LRC file from the page.

## Tech Stack

- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework with dark theme
- **Vanilla JavaScript (ES Modules)** - No framework, keeping it lightweight
- **Web Audio API / HTML5 Audio** - Native browser audio playback
- **File API / Drag & Drop API** - Native browser file handling

## Project Structure

```
lrceditor/
├── index.html              # Main HTML with Tailwind classes
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind configuration with custom primary colors
├── postcss.config.js       # PostCSS configuration
├── package.json            # Dependencies (minimal: vite, tailwindcss, postcss, autoprefixer)
├── src/
│   ├── main.js             # Entry point, initializes app
│   ├── style.css           # Tailwind imports + custom component classes
│   ├── lrc-parser.js       # Parse/serialize LRC format, timestamp utilities
│   ├── audio-player.js     # AudioPlayer class - playback controls, events
│   ├── editor.js           # LyricEditor class - timestamp adjustment, line selection
│   └── ui.js               # UI class - DOM manipulation, event handlers, drag/drop
├── public/
│   ├── manifest.json       # PWA manifest for installable app
│   └── favicon.ico
└── .github/
    └── copilot-instructions.md
```

## Architecture

The app runs entirely in the user's browser. Their LRC files and music files are
never uploaded anywhere. The site is served as a static website with a PWA manifest
so users can install it on their devices.

### Core Classes

- **AudioPlayer** (`audio-player.js`): Wraps HTML5 Audio element, provides play/pause/seek,
  emits callbacks for timeupdate, play, pause, ended, durationchange.

- **LyricEditor** (`editor.js`): Manages lyrics data and metadata, handles line selection,
  timestamp adjustments (±0.1s increments), tracks currently playing line index.

- **UI** (`ui.js`): Connects AudioPlayer and LyricEditor to the DOM, handles all event
  listeners (drag/drop, keyboard, mouse wheel, clicks), renders lyrics display.

### Data Flow

1. User drops/pastes lyrics → `lrc-parser.js` parses to `{ metadata, lines }` → `LyricEditor.loadLyrics()`
2. User drops audio → `AudioPlayer.loadFile()` → triggers duration callback → auto-sync if unsynced
3. Playback → `onTimeUpdate` → `editor.updatePlayingLine()` → auto-select current line
4. User adjusts → `editor.adjustTimestamp()` → `player.seek()` → UI updates timestamp display
5. Export → `editor.toLRC()` → copy to clipboard or download as file

## Coding Conventions

- Use ES modules (`import`/`export`)
- Classes for stateful components (AudioPlayer, LyricEditor, UI)
- Pure functions for utilities (lrc-parser.js)
- Callbacks instead of EventEmitter for simplicity
- Tailwind utility classes in HTML, custom components in `@layer components`
- Dark theme by default (slate color palette)
- Use `primary-*` color scale for accent colors (indigo-based)

## LRC Format Reference

```
[ar:Artist Name]
[ti:Song Title]
[al:Album Name]
[by:LRC Author]

[00:12.34]First line of lyrics
[00:15.67]Second line of lyrics
[01:02.00]Timestamp format is [mm:ss.xx] (hundredths of seconds)
```

Supported metadata tags: `ar` (artist), `ti` (title), `al` (album), `by` (author), `offset`

## Future Enhancements

- Lyrics extraction API integration (upload audio, get lyrics back)
- Waveform visualization
- Multiple timestamp selection for batch adjustments
- Undo/redo functionality
- Export to other subtitle formats (SRT, VTT)

## New Workflow

1. Add song
2. Add lyrics
   - Import from https://lrclib.net/ (API docs at https://lrclib.net/docs)
   - Import from any text file format
   - Manually enter lyrics in editor
3. Detect artist/album/track information from tags if possible, or allow user to set the LRC tags manually (optional). See [LRC File Format](https://en.wikipedia.org/wiki/LRC_(file_format)) for the available tag options.
4. User syncs lyrics using audio player and the lyric sync controls
5. User downloads LRC file, or copies contents to clipboard
6. User can optionally publish synced lyrics to lrclib.net (see the lrclib docs at https://lrclib.net/docs)


## Test Files

There are test music and LRC files under `test\` we can use to text the frontend through the playwright MCP.
