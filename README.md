# 🎵 LRC Editor

A modern web app for editing and syncing LRC lyric files with your music.

## Features

- **Drag & Drop** - Drop LRC files or plain text lyrics directly into the browser
- **Audio Support** - Works with MP3, FLAC, OGG, M4A, and WAV files
- **Easy Timestamp Adjustment** - Use arrow keys or mouse wheel to fine-tune timestamps
- **Auto-Sync** - Automatically generates timestamps for unsynced lyrics
- **Metadata Editing** - Edit artist, album, and title information
- **Export** - Copy to clipboard or download the edited LRC file
- **PWA Support** - Install as an app on your device
- **Works Offline** - Your files never leave your browser

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

1. **Load Lyrics** - Drag & drop an LRC file, paste lyrics, or type them in
2. **Load Audio** - Drag & drop a music file (MP3, FLAC, OGG, M4A)
3. **Adjust Timestamps** - Click a line to select it, then:
   - Press `↑`/`←` or scroll up to decrease timestamp by 0.1s
   - Press `↓`/`→` or scroll down to increase timestamp by 0.1s
   - Press `Enter` to move to the next line
   - Press `Space` to play/pause
4. **Export** - Click "Copy" or "Download" to save your edited lyrics

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `←` | Decrease timestamp by 0.1s |
| `↓` / `→` | Increase timestamp by 0.1s |
| `Space` | Play / Pause |
| `Enter` | Next line |
| `Backspace` | Previous line |
| Mouse Wheel | Adjust timestamp |

## LRC Format

The app supports standard LRC format:

```
[ar:Artist Name]
[ti:Song Title]
[al:Album Name]

[00:12.34]First line of lyrics
[00:15.67]Second line of lyrics
```

## Tech Stack

- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Vanilla JavaScript** - No framework overhead
- **Web Audio API** - Audio playback
- **PWA** - Installable app support

## License

MIT
