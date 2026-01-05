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
  
  // Add lyric lines
  for (const line of lines) {
    const timestamp = formatTimestamp(line.time);
    output.push(`${timestamp}${line.text}`);
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
