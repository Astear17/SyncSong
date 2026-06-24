/**
 * LRC Parser - Parse and serialize LRC format lyrics
 */

/**
 * Parse a timestamp string [mm:ss.xx] to seconds
 * @param {string} timestamp - Timestamp in format [mm:ss.xx] or [mm:ss:xx]
 * @returns {number} Time in seconds
 */
export function parseTimestamp(timestamp) {
  // Remove brackets if present
  const clean = timestamp.replace(/[\[\]]/g, '');
  
  // Handle both [mm:ss.xx] and [mm:ss:xx] formats
  const parts = clean.split(/[:.]/).map(Number);
  
  if (parts.length === 3) {
    const [minutes, seconds, hundredths] = parts;
    return minutes * 60 + seconds + hundredths / 100;
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }
  
  return 0;
}

/**
 * Format seconds to timestamp string [mm:ss.xx]
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(seconds) {
  if (seconds < 0) seconds = 0;
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.round((seconds % 1) * 100);
  
  return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}]`;
}

/**
 * Parse LRC content into structured data
 * @param {string} content - Raw LRC file content
 * @returns {{ metadata: object, lines: Array<{time: number, text: string}> }}
 */
export function parseLRC(content) {
  const lines = content.split(/\r?\n/);
  const metadata = {};
  const lyrics = [];
  
  // Metadata tag patterns
  const metadataPattern = /^\[([a-z]+):(.+)\]$/i;
  // Timestamp pattern - matches [mm:ss.xx] or [mm:ss:xx]
  const timestampPattern = /^\[(\d{1,2}):(\d{2})[.:](\d{2})\]/;
  // Multiple timestamps on one line
  const multiTimestampPattern = /(\[\d{1,2}:\d{2}[.:]\d{2}\])+(.*)$/;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) continue;
    
    // Check for metadata tags
    const metaMatch = trimmed.match(metadataPattern);
    if (metaMatch && !timestampPattern.test(trimmed)) {
      const [, tag, value] = metaMatch;
      const tagLower = tag.toLowerCase();
      
      // Map common tags
      switch (tagLower) {
        case 'ar':
          metadata.artist = value.trim();
          break;
        case 'ti':
          metadata.title = value.trim();
          break;
        case 'al':
          metadata.album = value.trim();
          break;
        case 'by':
          metadata.author = value.trim();
          break;
        case 'offset':
          metadata.offset = parseInt(value, 10);
          break;
        default:
          metadata[tagLower] = value.trim();
      }
      continue;
    }
    
    // Check for timestamped lines
    const multiMatch = trimmed.match(multiTimestampPattern);
    if (multiMatch) {
      const text = multiMatch[2].trim();
      // Extract all timestamps
      const timestamps = trimmed.match(/\[\d{1,2}:\d{2}[.:]\d{2}\]/g) || [];
      
      for (const ts of timestamps) {
        lyrics.push({
          time: parseTimestamp(ts),
          text: text
        });
      }
      continue;
    }
    
    // Plain text line (no timestamp) - treat as unsynced lyrics
    if (!timestampPattern.test(trimmed)) {
      lyrics.push({
        time: null,
        text: trimmed
      });
    }
  }
  
  // Sort lyrics by time (null times go at the end for now)
  lyrics.sort((a, b) => {
    if (a.time === null && b.time === null) return 0;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time - b.time;
  });
  
  return { metadata, lines: lyrics };
}

/**
 * Check if content appears to be synced (has timestamps)
 * @param {string} content - Raw content
 * @returns {boolean}
 */
export function isSyncedLyrics(content) {
  const timestampPattern = /\[\d{1,2}:\d{2}[.:]\d{2}\]/;
  return timestampPattern.test(content);
}

/**
 * Generate timestamps for unsynced lyrics based on audio duration
 * @param {Array<{time: number|null, text: string}>} lines - Parsed lyrics
 * @param {number} duration - Audio duration in seconds
 * @returns {Array<{time: number, text: string}>}
 */
export function generateTimestamps(lines, duration) {
  const nonEmptyLines = lines.filter(l => l.text.trim());
  const interval = duration / (nonEmptyLines.length || 1);
  
  return lines.map((line, index) => ({
    time: line.time !== null ? line.time : index * interval,
    text: line.text
  }));
}

/**
 * Serialize lyrics data back to LRC format
 * @param {{ metadata: object, lines: Array<{time: number, text: string}> }} data
 * @returns {string} LRC formatted content
 */
export function serializeLRC(data) {
  const { metadata, lines } = data;
  const output = [];
  
  // Add metadata tags
  if (metadata.artist) output.push(`[ar:${metadata.artist}]`);
  if (metadata.title) output.push(`[ti:${metadata.title}]`);
  if (metadata.album) output.push(`[al:${metadata.album}]`);
  if (metadata.author) output.push(`[by:${metadata.author}]`);
  if (metadata.offset) output.push(`[offset:${metadata.offset}]`);
  
  // Add any other metadata
  for (const [key, value] of Object.entries(metadata)) {
    if (!['artist', 'title', 'album', 'author', 'offset'].includes(key)) {
      output.push(`[${key}:${value}]`);
    }
  }
  
  // Add blank line after metadata if we have any
  if (output.length > 0) {
    output.push('');
  }
  
  // Add lyric lines (only include lines that have timestamps)
  for (const line of lines) {
    if (line.time !== null) {
      const timestamp = formatTimestamp(line.time);
      output.push(`${timestamp}${line.text}`);
    }
  }
  
  return output.join('\n');
}

/**
 * Parse plain text lyrics (one line per line)
 * @param {string} content - Plain text content
 * @returns {Array<{time: number|null, text: string}>}
 */
export function parsePlainLyrics(content) {
  return content
    .split(/\r?\n/)
    .map(line => ({
      time: null,
      text: line.trim()
    }))
    .filter(line => line.text.length > 0 || true); // Keep empty lines for structure
}

// ─── Enhanced LRC / A2 Word-by-Word Support ─────────────────────────────────

const WORD_TS_RE = /<(\d{1,2}):(\d{2})[.:](\d{2})>/g;

export function formatWordTimestamp(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.round((seconds % 1) * 100);
  return `<${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}>`;
}

function parseAngleTimestamp(str) {
  const m = str.match(/(\d{1,2}):(\d{2})[.:](\d{2})/);
  if (!m) return 0;
  return parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / 100;
}

function tokenizeWithTimestamps(textWithTags) {
  const tokens = [];
  let remaining = textWithTags;
  let pendingSpace = '';

  while (remaining.length > 0) {
    const idx = remaining.indexOf('<');
    if (idx === -1) {
      const t = remaining;
      if (t) tokens.push({ text: t, startTime: null });
      break;
    }

    const closeIdx = remaining.indexOf('>', idx);
    if (closeIdx === -1) {
      tokens.push({ text: remaining, startTime: null });
      break;
    }

    const tag = remaining.substring(idx, closeIdx + 1);
    if (/^<\d{1,2}:\d{2}[.:]\d{2}>$/.test(tag)) {
      if (idx > 0) {
        tokens.push({ text: remaining.substring(0, idx), startTime: null });
      }
      tokens.push({ text: '', startTime: parseAngleTimestamp(tag), _isTag: true });
      remaining = remaining.substring(closeIdx + 1);
    } else {
      tokens.push({ text: remaining.substring(0, closeIdx + 1), startTime: null });
      remaining = remaining.substring(closeIdx + 1);
    }
  }

  const words = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok._isTag) {
      const ts = tok.startTime;
      let wordText = '';
      let j = i + 1;
      while (j < tokens.length && !tokens[j]._isTag && tokens[j].text) {
        wordText += tokens[j].text;
        j++;
      }
      if (wordText) {
        const leadingMatch = wordText.match(/^(\s*)/);
        const trailingMatch = wordText.match(/(\s*)$/);
        const leadingSpace = leadingMatch ? leadingMatch[1] : '';
        const trailingSpace = trailingMatch ? trailingMatch[1] : '';
        const core = wordText.trim();
        if (core) {
          words.push({ text: core, startTime: ts, leadingSpace, trailingSpace });
        }
      }
      i = j - 1;
    } else if (tok.text.trim()) {
      words.push({ text: tok.text.trim(), startTime: null });
    }
  }

  return words;
}

function reconstructText(words) {
  let s = '';
  for (const w of words) {
    if (w.leadingSpace) s += w.leadingSpace;
    s += w.text;
    if (w.trailingSpace) s += w.trailingSpace;
  }
  return s;
}

/**
 * Parse Enhanced LRC content with optional <mm:ss.xx> word tags
 * @param {string} content - Raw LRC content
 * @returns {{ metadata: object, lines: Array<{time: number|null, text: string, words?: Array}> }}
 */
export function parseEnhancedLRC(content) {
  const rawLines = content.split(/\r?\n/);
  const metadata = {};
  const lyrics = [];

  const metadataPattern = /^\[([a-z]+):(.+)\]$/i;
  const timestampPattern = /^\[(\d{1,2}):(\d{2})[.:](\d{2})\]/;
  const multiTimestampPattern = /(\[\d{1,2}:\d{2}[.:]\d{2}\])+(.*)$/;
  const angleTagPattern = /<\d{1,2}:\d{2}[.:]\d{2}>/;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const metaMatch = trimmed.match(metadataPattern);
    if (metaMatch && !timestampPattern.test(trimmed)) {
      const [, tag, value] = metaMatch;
      const tagLower = tag.toLowerCase();
      switch (tagLower) {
        case 'ar': metadata.artist = value.trim(); break;
        case 'ti': metadata.title = value.trim(); break;
        case 'al': metadata.album = value.trim(); break;
        case 'by': metadata.author = value.trim(); break;
        case 'offset': metadata.offset = parseInt(value, 10); break;
        default: metadata[tagLower] = value.trim();
      }
      continue;
    }

    const multiMatch = trimmed.match(multiTimestampPattern);
    if (multiMatch) {
      const timestamps = trimmed.match(/\[\d{1,2}:\d{2}[.:]\d{2}\]/g) || [];
      const afterTimestamps = multiMatch[2];
      const hasAngleTags = angleTagPattern.test(afterTimestamps);

      if (hasAngleTags) {
        const words = tokenizeWithTimestamps(afterTimestamps);
        const displayText = reconstructText(words);
        for (const ts of timestamps) {
          lyrics.push({
            time: parseTimestamp(ts),
            text: displayText,
            words: words.map(w => ({ ...w }))
          });
        }
      } else {
        const text = afterTimestamps.trim();
        for (const ts of timestamps) {
          lyrics.push({ time: parseTimestamp(ts), text });
        }
      }
      continue;
    }

    if (!timestampPattern.test(trimmed)) {
      if (angleTagPattern.test(trimmed)) {
        const words = tokenizeWithTimestamps(trimmed);
        const displayText = reconstructText(words);
        lyrics.push({ time: null, text: displayText, words });
      } else {
        lyrics.push({ time: null, text: trimmed });
      }
    }
  }

  lyrics.sort((a, b) => {
    if (a.time === null && b.time === null) return 0;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time - b.time;
  });

  return { metadata, lines: lyrics };
}

/**
 * Serialize lyrics data to Enhanced LRC format with word timestamps
 * @param {{ metadata: object, lines: Array }} data
 * @returns {string}
 */
export function serializeEnhancedLRC(data) {
  const { metadata, lines } = data;
  const output = [];

  if (metadata.artist) output.push(`[ar:${metadata.artist}]`);
  if (metadata.title) output.push(`[ti:${metadata.title}]`);
  if (metadata.album) output.push(`[al:${metadata.album}]`);
  if (metadata.author) output.push(`[by:${metadata.author}]`);
  if (metadata.offset) output.push(`[offset:${metadata.offset}]`);
  for (const [key, value] of Object.entries(metadata)) {
    if (!['artist', 'title', 'album', 'author', 'offset'].includes(key)) {
      output.push(`[${key}:${value}]`);
    }
  }
  if (output.length > 0) output.push('');

  for (const line of lines) {
    if (line.time === null) continue;

    const lineTs = formatTimestamp(line.time);
    if (line.words && line.words.length > 0) {
      let wordPart = '';
      for (const w of line.words) {
        if (w.leadingSpace) wordPart += w.leadingSpace;
        if (w.startTime != null) {
          wordPart += formatWordTimestamp(w.startTime);
        }
        wordPart += w.text;
        if (w.trailingSpace) wordPart += w.trailingSpace;
      }
      output.push(`${lineTs}${wordPart}`);
    } else {
      output.push(`${lineTs}${line.text}`);
    }
  }

  return output.join('\n');
}

/**
 * Check if lyrics data contains any word-level timings
 * @param {{ lines: Array }} data
 * @returns {boolean}
 */
export function hasWordTimings(data) {
  return data.lines.some(l => Array.isArray(l.words) && l.words.some(w => w.startTime != null));
}

/**
 * Return a copy of the data with all word timings removed
 * @param {{ metadata: object, lines: Array }} data
 * @returns {{ metadata: object, lines: Array }}
 */
export function stripWordTimings(data) {
  return {
    metadata: { ...data.metadata },
    lines: data.lines.map(l => {
      const { words, ...rest } = l;
      return rest;
    })
  };
}
